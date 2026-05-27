import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useRealTimeUpdates } from '../useRealTimeUpdates';
import { SupabaseApiService } from '../../services/supabaseApi';
import type { Player, LeaderboardResponse, ApiError } from '../../types';

// Mock the useLeaderboardData hook
const mockLeaderboardData = {
  currentLeaderboardId: 'test-leaderboard-1',
  players: [] as Player[],
  updatePlayers: vi.fn(),
  setLoadingState: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
  lastUpdated: null,
};

vi.mock('../useAppState', () => ({
  useLeaderboardData: () => mockLeaderboardData,
}));

// Mock API service
const mockApiService = {
  getLeaderboardData: vi.fn(),
} as unknown as SupabaseApiService;

// Mock data
const mockPlayers: Player[] = [
  {
    _id: 'player1',
    player: 'player1',
    name: 'Player 1',
    position: 1,
    total: 100,
  },
  {
    _id: 'player2',
    player: 'player2',
    name: 'Player 2',
    position: 2,
    total: 80,
  },
];

const mockLeaderboardResponse: LeaderboardResponse = {
  leaderboard: {
    _id: 'test-leaderboard-1',
    title: 'Test Leaderboard',
    description: 'Test Description',
    principalType: 0,
    operation: {
      type: 1,
      achievement_type: 1,
      item: 'points',
      sort: -1,
    },
    period: {
      type: 1,
      timeAmount: 1,
      timeScale: 1,
    },
  },
  leaders: mockPlayers,
};

describe('useRealTimeUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset mock data
    mockLeaderboardData.currentLeaderboardId = 'test-leaderboard-1';
    mockLeaderboardData.players = [];
    
    // Mock successful API response by default
    (mockApiService.getLeaderboardData as any).mockResolvedValue(mockLeaderboardResponse);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      expect(result.current.isPolling).toBe(false);
      expect(result.current.isUpdating).toBe(false);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.timeSinceLastUpdate).toBe(0);
      expect(result.current.config.pollingInterval).toBe(30000);
      expect(result.current.config.enabled).toBe(true);
    });

    it('should start polling when enabled and leaderboard is set', async () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { pollingInterval: 1000 })
      );

      await act(async () => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith(
        'test-leaderboard-1',
        { live: true, maxResults: 100 }
      );
    });

    it('should stop polling when requested', async () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { pollingInterval: 1000 })
      );

      await act(async () => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('Data Fetching', () => {
    it('should fetch data and update players on successful response', async () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith(
        'test-leaderboard-1',
        { live: true, maxResults: 100 }
      );
      expect(mockLeaderboardData.updatePlayers).toHaveBeenCalledWith(mockPlayers);
      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
    });

    it('should detect player changes and add movement information', async () => {
      // Set initial players
      mockLeaderboardData.players = [
        { ...mockPlayers[0], position: 2 },
        { ...mockPlayers[1], position: 1 },
      ];

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      const updatedPlayers = (mockLeaderboardData.updatePlayers as any).mock.calls[0][0];
      
      // Player 1 moved from position 2 to 1 (up)
      expect(updatedPlayers[0]).toMatchObject({
        _id: 'player1',
        position: 1,
        previous_position: 2,
        move: 'up',
      });

      // Player 2 moved from position 1 to 2 (down)
      expect(updatedPlayers[1]).toMatchObject({
        _id: 'player2',
        position: 2,
        previous_position: 1,
        move: 'down',
      });
    });

    it('should not update players if no changes detected', async () => {
      // Set players to same as mock response
      mockLeaderboardData.players = [...mockPlayers];

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      // Should still call updatePlayers but with same data
      expect(mockLeaderboardData.updatePlayers).toHaveBeenCalledWith(mockPlayers);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry logic', async () => {
      const networkError: ApiError = {
        type: 'network',
        message: 'Network error',
        retryable: true,
        timestamp: Date.now(),
      };

      (mockApiService.getLeaderboardData as any)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockLeaderboardResponse);

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { retryDelay: 100, maxRetries: 2 })
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      // Should have attempted retry
      expect(result.current.retryCount).toBe(1);

      // Fast-forward retry delay
      await act(async () => {
        vi.advanceTimersByTime(100);
        await waitFor(() => {
          expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2);
        });
      });

      // Should succeed on retry
      expect(result.current.retryCount).toBe(0);
      expect(mockLeaderboardData.updatePlayers).toHaveBeenCalledWith(mockPlayers);
    });

    it('should set error state after max retries exceeded', async () => {
      const networkError: ApiError = {
        type: 'network',
        message: 'Network error',
        retryable: true,
        timestamp: Date.now(),
      };

      (mockApiService.getLeaderboardData as any).mockRejectedValue(networkError);

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { retryDelay: 100, maxRetries: 2 })
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      // Fast-forward through all retries
      await act(async () => {
        vi.advanceTimersByTime(100); // First retry
        await waitFor(() => expect(result.current.retryCount).toBe(1));
        
        vi.advanceTimersByTime(200); // Second retry (exponential backoff)
        await waitFor(() => expect(result.current.retryCount).toBe(2));
        
        vi.advanceTimersByTime(400); // Third attempt fails, should set error
        await waitFor(() => {
          expect(mockLeaderboardData.setError).toHaveBeenCalledWith(networkError);
        });
      });

      expect(result.current.retryCount).toBe(0); // Reset after max retries
    });

    it('should not retry non-retryable errors', async () => {
      const authError: ApiError = {
        type: 'auth',
        message: 'Authentication failed',
        retryable: false,
        timestamp: Date.now(),
      };

      (mockApiService.getLeaderboardData as any).mockRejectedValue(authError);

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      await act(async () => {
        await result.current.forceUpdate();
      });

      expect(result.current.retryCount).toBe(0);
      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(authError);
    });
  });

  describe('Polling Behavior', () => {
    it('should poll at specified intervals', async () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { pollingInterval: 1000 })
      );

      await act(async () => {
        result.current.startPolling();
      });

      // Initial call
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(1);

      // Advance time and check for additional calls
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await waitFor(() => {
          expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2);
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await waitFor(() => {
          expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(3);
        });
      });
    });

    it('should not poll when disabled', () => {
      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { enabled: false })
      );

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(false);
      expect(mockApiService.getLeaderboardData).not.toHaveBeenCalled();
    });

    it('should not poll when no leaderboard is selected', () => {
      mockLeaderboardData.currentLeaderboardId = null;

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService)
      );

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(false);
      expect(mockApiService.getLeaderboardData).not.toHaveBeenCalled();
    });
  });

  describe('Visibility Handling', () => {
    it('should pause updates when tab is hidden and resume when visible', async () => {
      Object.defineProperty(document, 'hidden', {
        writable: true,
        value: false,
      });

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, { 
          pollingInterval: 1000,
          pauseOnHidden: true 
        })
      );

      await act(async () => {
        result.current.startPolling();
      });

      // Initial call when visible
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(1);

      // Hide the tab
      act(() => {
        Object.defineProperty(document, 'hidden', { value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Advance time - should not make additional calls when hidden
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(1);

      // Show the tab again
      act(() => {
        Object.defineProperty(document, 'hidden', { value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });

      // Should force an immediate update when becoming visible
      await waitFor(() => {
        expect(mockApiService.getLeaderboardData).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration values', () => {
      const customConfig = {
        pollingInterval: 5000,
        enabled: false,
        maxRetries: 5,
        retryDelay: 2000,
        pauseOnHidden: false,
      };

      const { result } = renderHook(() =>
        useRealTimeUpdates(mockApiService, customConfig)
      );

      expect(result.current.config).toEqual(customConfig);
    });

    it('should handle configuration changes', () => {
      const { result, rerender } = renderHook(
        ({ config }) => useRealTimeUpdates(mockApiService, config),
        { initialProps: { config: { pollingInterval: 1000 } } }
      );

      expect(result.current.config.pollingInterval).toBe(1000);

      rerender({ config: { pollingInterval: 5000 } });

      expect(result.current.config.pollingInterval).toBe(5000);
    });
  });
});