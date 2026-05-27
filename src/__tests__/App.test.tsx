import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { SupabaseApiService } from '../services/supabaseApi';
import { 
  createMockApiService, 
  mockPlayersSet, 
  mockLeaderboardsSet,
  mockEnvironmentVariables 
} from '../test/utils/testUtils';

// Mock the API service
vi.mock('../services/supabaseApi');

describe('App Component', () => {
  let mockApiService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEnvironmentVariables();
    
    mockApiService = createMockApiService({
      getLeaderboards: vi.fn().mockResolvedValue(mockLeaderboardsSet.multiple),
      getLeaderboardData: vi.fn().mockResolvedValue({
        leaderboard: mockLeaderboardsSet.multiple[0],
        leaders: mockPlayersSet.small,
      }),
    });
    
    (SupabaseApiService as any).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should render loading state initially', () => {
      render(<App />);
      
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should load leaderboards on mount', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });
    });

    it('should display main components after loading', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should display main components
      await waitFor(() => {
        expect(screen.getByText('Championship')).toBeInTheDocument();
      });
      
      expect(screen.getByRole('combobox')).toBeInTheDocument(); // Leaderboard selector
      expect(screen.getByText('🏁 Chicken Race Championship 🏁')).toBeInTheDocument(); // Race title
      expect(screen.getByText('🏆 Top Players')).toBeInTheDocument(); // Sidebar
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API fails', async () => {
      mockApiService.getLeaderboards.mockRejectedValue(new Error('API Error'));
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should provide retry functionality', async () => {
      mockApiService.getLeaderboards.mockRejectedValueOnce(new Error('API Error'))
                                   .mockResolvedValue(mockLeaderboardsSet.multiple);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/retry/i);
      await userEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Championship')).toBeInTheDocument();
      });
    });
  });

  describe('Leaderboard Management', () => {
    it('should allow switching between leaderboards', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const selector = await screen.findByRole('combobox');
      await user.click(selector);

      // Should show dropdown options
      await waitFor(() => {
        expect(screen.getByText('Weekly Challenge')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Weekly Challenge'));

      // Should call API for new leaderboard
      await waitFor(() => {
        expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith('lb2');
      });
    });

    it('should support auto-cycling between leaderboards', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Enable auto-cycle
      const autoCycleToggle = await screen.findByLabelText(/auto cycle/i);
      await user.click(autoCycleToggle);

      expect(autoCycleToggle).toBeChecked();

      // Fast-forward to trigger auto-cycle (5 minutes)
      await act(async () => {
        vi.advanceTimersByTime(5 * 60 * 1000);
      });

      // Should have switched to next leaderboard
      await waitFor(() => {
        expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith('lb2');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should poll for updates periodically', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Initial load
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(1);

      // Fast-forward to trigger polling (30 seconds)
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should have polled for updates
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2);
    });

    it('should handle polling errors gracefully', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Simulate polling error
      mockApiService.getLeaderboardData.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      // Should show error indicator but maintain last known state
      await waitFor(() => {
        expect(screen.getByText(/connection/i)).toBeInTheDocument();
      });
      
      // Should still show previous data
      expect(screen.getByText('Mock Player')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });

      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should show mobile-optimized layout
      const container = screen.getByRole('main');
      expect(container).toHaveClass('min-h-screen');
    });

    it('should handle window resize events', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      // Simulate window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      window.dispatchEvent(new Event('resize'));

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Should adapt layout accordingly
      const container = screen.getByRole('main');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA structure', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should have main landmark
      expect(screen.getByRole('main')).toBeInTheDocument();
      
      // Should have proper heading structure
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      
      // Interactive elements should have labels
      const selector = screen.getByRole('combobox');
      expect(selector).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should be able to navigate with keyboard
      await user.tab();
      
      const focusedElement = document.activeElement;
      expect(focusedElement).toBeInstanceOf(HTMLElement);
      expect(focusedElement?.tagName).toMatch(/BUTTON|SELECT|INPUT/);
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const largePlayers = Array.from({ length: 1000 }, (_, i) => ({
        _id: `player-${i}`,
        player: `player-${i}`,
        name: `Player ${i}`,
        position: i + 1,
        total: 10000 - i,
      }));

      mockApiService.getLeaderboardData.mockResolvedValue({
        leaderboard: mockLeaderboardsSet.multiple[0],
        leaders: largePlayers,
      });

      const startTime = performance.now();
      
      render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      const renderTime = performance.now() - startTime;
      
      // Should render large datasets in reasonable time
      expect(renderTime).toBeLessThan(2000);
      
      // Should show performance optimization message
      await waitFor(() => {
        expect(screen.getByText(/large dataset/i)).toBeInTheDocument();
      });
    });

    it('should not cause memory leaks', async () => {
      const { unmount } = render(<App />);
      
      await waitFor(() => {
        expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Unmount component
      unmount();

      // Should clean up timers and listeners
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // No additional API calls should be made after unmount
      const callCount = mockApiService.getLeaderboardData.mock.calls.length;
      
      await act(async () => {
        vi.advanceTimersByTime(30000);
      });

      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Configuration', () => {
    it('should handle missing environment variables', async () => {
      vi.unstubAllEnvs();
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/configuration error/i)).toBeInTheDocument();
      });
    });

    it('should validate API configuration', async () => {
      mockApiService.testConnection.mockResolvedValue(false);
      
      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText(/connection test failed/i)).toBeInTheDocument();
      });
    });
  });
});