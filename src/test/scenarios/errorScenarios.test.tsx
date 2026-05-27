import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { SupabaseApiService } from '../../services/supabaseApi';
import { 
  createMockApiService, 
  createNetworkError, 
  createApiError, 
  createTimeoutError,
  mockEnvironmentVariables 
} from '../utils/testUtils';

// Mock the API service
vi.mock('../../services/supabaseApi');

describe('Error Scenarios and Edge Cases', () => {
  let mockApiService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEnvironmentVariables();
    
    mockApiService = createMockApiService();
    (SupabaseApiService as any).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Network Failures', () => {
    it('should handle initial connection failure', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(createNetworkError('Connection failed'));
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/retry/i)).toBeInTheDocument();
    });

    it('should retry failed requests with exponential backoff', async () => {
      let callCount = 0;
      mockApiService.getLeaderboards.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(createNetworkError('Network timeout'));
        }
        return Promise.resolve([]);
      });

      render(<App />);

      // Should retry automatically
      await act(async () => {
        vi.advanceTimersByTime(1000); // First retry
      });

      await act(async () => {
        vi.advanceTimersByTime(2000); // Second retry (exponential backoff)
      });

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle timeout errors during data fetching', async () => {
      mockApiService.getLeaderboardData.mockRejectedValue(createTimeoutError());
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/timeout/i)).toBeInTheDocument();
      });
    });

    it('should maintain last known good state during network issues', async () => {
      // Initial successful load
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Verify initial data is loaded
      await waitFor(() => {
        expect(screen.getByText('Mock Player')).toBeInTheDocument();
      });

      // Simulate network failure on subsequent updates
      mockApiService.getLeaderboardData.mockRejectedValue(createNetworkError('Network down'));

      // Trigger polling update
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should still show last known data
      expect(screen.getByText('Mock Player')).toBeInTheDocument();
      
      // Should show error indicator
      await waitFor(() => {
        expect(screen.getByText(/connection issue/i)).toBeInTheDocument();
      });
    });
  });

  describe('API Errors', () => {
    it('should handle 401 authentication errors', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(createApiError(401, 'Unauthorized'));
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/authentication/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/check credentials/i)).toBeInTheDocument();
    });

    it('should handle 403 forbidden errors', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(createApiError(403, 'Forbidden'));
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/access denied/i)).toBeInTheDocument();
      });
    });

    it('should handle 404 not found errors', async () => {
      mockApiService.getLeaderboardData.mockRejectedValue(createApiError(404, 'Leaderboard not found'));
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/leaderboard not found/i)).toBeInTheDocument();
      });
    });

    it('should handle 500 server errors', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(createApiError(500, 'Internal server error'));
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/try again later/i)).toBeInTheDocument();
    });

    it('should handle rate limiting (429 errors)', async () => {
      mockApiService.getLeaderboardData.mockRejectedValue(createApiError(429, 'Too many requests'));
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/rate limit/i)).toBeInTheDocument();
      });
    });
  });

  describe('Data Validation Errors', () => {
    it('should handle malformed API responses', async () => {
      mockApiService.getLeaderboards.mockResolvedValue('invalid data');
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/invalid data/i)).toBeInTheDocument();
      });
    });

    it('should handle missing required fields in leaderboard data', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: null, // Missing leaderboard
        leaders: [],
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid leaderboard/i)).toBeInTheDocument();
      });
    });

    it('should handle players with missing required fields', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: { _id: 'test', title: 'Test' },
        leaders: [
          { _id: '1' }, // Missing required fields
          { name: 'Player 2' }, // Missing _id
        ],
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should filter out invalid players and show warning
      await waitFor(() => {
        expect(screen.getByText(/some players could not be displayed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Configuration Errors', () => {
    it('should handle missing environment variables', async () => {
      vi.unstubAllEnvs();
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
      });

      expect(screen.getByText(/environment variables/i)).toBeInTheDocument();
    });

    it('should handle invalid API configuration', async () => {
      mockEnvironmentVariables({
        VITE_SUPABASE_URL: 'invalid-url',
      });
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/invalid configuration/i)).toBeInTheDocument();
      });
    });

    it('should handle API connection test failure', async () => {
      mockApiService.testConnection.mockResolvedValue(false);
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/connection test failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty leaderboards list', async () => {
      mockApiService.getLeaderboards.mockResolvedValue([]);
      
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/no leaderboards available/i)).toBeInTheDocument();
      });
    });

    it('should handle leaderboard with no players', async () => {
      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: { _id: 'test', title: 'Empty Leaderboard' },
        leaders: [],
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(screen.getByText(/no players in this race/i)).toBeInTheDocument();
      });
    });

    it('should handle extremely large player counts', async () => {
      const largePlayers = Array.from({ length: 10000 }, (_, i) => ({
        _id: `player-${i}`,
        player: `player-${i}`,
        name: `Player ${i}`,
        position: i + 1,
        total: 10000 - i,
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: { _id: 'test', title: 'Large Leaderboard' },
        leaders: largePlayers,
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should handle large datasets without crashing
      await waitFor(() => {
        expect(screen.getByText('Player 0')).toBeInTheDocument();
      });

      // Should show performance warning for large datasets
      expect(screen.getByText(/large dataset/i)).toBeInTheDocument();
    });

    it('should handle players with identical scores and positions', async () => {
      const tiedPlayers = Array.from({ length: 5 }, (_, i) => ({
        _id: `player-${i}`,
        player: `player-${i}`,
        name: `Player ${i}`,
        position: 1, // All tied for first
        total: 100, // Same score
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: { _id: 'test', title: 'Tied Leaderboard' },
        leaders: tiedPlayers,
      });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should handle tied positions correctly
      await waitFor(() => {
        expect(screen.getAllByText('1')).toHaveLength(5); // All show position 1
      });
    });

    it('should handle rapid leaderboard switching', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const selector = await screen.findByRole('combobox');

      // Rapidly switch between leaderboards
      for (let i = 0; i < 10; i++) {
        await user.click(selector);
        await user.keyboard('{ArrowDown}{Enter}');
        
        await act(async () => {
          vi.advanceTimersByTime(100);
        });
      }

      // Should handle rapid switching without errors
      expect(mockApiService.getLeaderboardData).toHaveBeenCalled();
    });
  });

  describe('Recovery Scenarios', () => {
    it('should recover from network errors when connection is restored', async () => {
      let networkDown = true;
      mockApiService.getLeaderboards.mockImplementation(() => {
        if (networkDown) {
          return Promise.reject(createNetworkError('Network down'));
        }
        return Promise.resolve([{ _id: 'test', title: 'Recovered Leaderboard' }]);
      });

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      });

      // Simulate network recovery
      networkDown = false;
      
      const retryButton = screen.getByText(/retry/i);
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Recovered Leaderboard')).toBeInTheDocument();
      });
    });

    it('should automatically retry after temporary failures', async () => {
      let failCount = 0;
      mockApiService.getLeaderboardData.mockImplementation(() => {
        failCount++;
        if (failCount <= 2) {
          return Promise.reject(createNetworkError('Temporary failure'));
        }
        return Promise.resolve({
          leaderboard: { _id: 'test', title: 'Recovered Data' },
          leaders: [{ _id: '1', name: 'Recovered Player', position: 1, total: 100 }],
        });
      });

      render(<App />);

      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      // Wait for automatic retries
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });

      await waitFor(() => {
        expect(screen.getByText('Recovered Player')).toBeInTheDocument();
      });
    });
  });
});