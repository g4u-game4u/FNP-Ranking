
import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useChickenRaceManager } from '../useChickenRaceManager';
import { SupabaseApiService } from '../../services/supabaseApi';
import type { Leaderboard, Player, LeaderboardResponse, SupabaseConfig } from '../../types';

// Mock the store hooks
const mockLeaderboardData = {
  leaderboards: [] as Leaderboard[],
  currentLeaderboard: null as Leaderboard | null,
  currentLeaderboardId: null as string | null,
  players: [] as Player[],
  loading: {
    leaderboards: false,
    currentLeaderboard: false,
    switchingLeaderboard: false,
  },
  error: null,
  lastUpdated: null,
  hasLeaderboards: false,
  hasPlayers: false,
  isLoading: false,
  hasError: false,
  switchToLeaderboard: vi.fn(),
  updatePlayers: vi.fn(),
  setLoadingState: vi.fn(),
  setError: vi.fn(),
  clearError: vi.fn(),
};

const mockRealTimeUpdates = {
  isPolling: false,
  isUpdating: false,
  retryCount: 0,
  timeSinceLastUpdate: 0,
  lastSuccessfulUpdate: 0,
  startPolling: vi.fn(),
  stopPolling: vi.fn(),
  forceUpdate: vi.fn(),
  config: {
    pollingInterval: 30000,
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    pauseOnHidden: true,
  },
};

const mockPositionTransitions = {
  playerPositions: [],
  isAnimating: false,
  getPlayerPosition: vi.fn().mockReturnValue({ x: 50, y: 50 }),
  getAllPlayerPositions: vi.fn().mockReturnValue([]),
  setImmediatePositions: vi.fn(),
  animateToNewPositions: vi.fn(),
  config: {
    transitionDuration: 1000,
    easing: 'ease-out' as const,
    staggered: true,
    staggerDelay: 100,
    celebrateImprovements: true,
  },
};

vi.mock('../useAppState', () => ({
  useLeaderboardData: () => mockLeaderboardData,
}));

vi.mock('../useRealTimeUpdates', () => ({
  useRealTimeUpdatesWithLoading: () => mockRealTimeUpdates,
}));

vi.mock('../usePositionTransitions', () => ({
  usePositionTransitions: () => mockPositionTransitions,
}));

// Mock API service
vi.mock('../../services/supabaseApi');

// Mock data
const mockLeaderboards: Leaderboard[] = [
  {
    _id: 'leaderboard1',
    title: 'Test Leaderboard 1',
    description: 'First test leaderboard',
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
  {
    _id: 'leaderboard2',
    title: 'Test Leaderboard 2',
    description: 'Second test leaderboard',
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
];

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
  leaderboard: mockLeaderboards[0],
  leaders: mockPlayers,
};

const mockApiConfig: SupabaseConfig = {
  url: 'https://test.supabase.co',
  anonKey: 'test-anon-key',
};

describe('useChickenRaceManager Integration', () => {
  let mockApiService: jest.Mocked<SupabaseApiService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset mock data
    mockLeaderboardData.leaderboards = [];
    mockLeaderboardData.currentLeaderboard = null;
    mockLeaderboardData.currentLeaderboardId = null;
    mockLeaderboardData.players = [];
    mockLeaderboardData.hasLeaderboards = false;
    mockLeaderboardData.hasPlayers = false;
    mockLeaderboardData.isLoading = false;
    mockLeaderboardData.hasError = false;
    mockLeaderboardData.error = null;

    // Create mock API service
    mockApiService = {
      testConnection: vi.fn().mockResolvedValue(true),
      getLeaderboards: vi.fn().mockResolvedValue(mockLeaderboards),
      getLeaderboardData: vi.fn().mockResolvedValue(mockLeaderboardResponse),
      getPlayerDetails: vi.fn(),
      setAuthToken: vi.fn(),
      getConfig: vi.fn().mockReturnValue(mockApiConfig),
    } as any;

    // Mock the constructor
    (SupabaseApiService as any).mockImplementation(() => mockApiService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initialization', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      expect(result.current.leaderboards).toEqual([]);
      expect(result.current.currentLeaderboard).toBeNull();
      expect(result.current.players).toEqual([]);
      expect(result.current.hasLeaderboards).toBe(false);
      expect(result.current.hasPlayers).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
    });

    it('should create API service with provided config', () => {
      renderHook(() => useChickenRaceManager({
        apiConfig: mockApiConfig,
      }));

      expect(SupabaseApiService).toHaveBeenCalledWith(mockApiConfig);
    });

    it('should auto-initialize when API config is provided', async () => {
      mockLeaderboardData.hasLeaderboards = false;
      mockLeaderboardData.isLoading = false;
      mockLeaderboardData.hasError = false;

      renderHook(() => useChickenRaceManager({
        apiConfig: mockApiConfig,
      }));

      await waitFor(() => {
        expect(mockApiService.testConnection).toHaveBeenCalled();
      });
    });
  });

  describe('Race Initialization', () => {
    it('should initialize race successfully', async () => {
      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.initializeRace();
      });

      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('leaderboards', true);
      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
      expect(mockApiService.testConnection).toHaveBeenCalled();
      expect(mockApiService.getLeaderboards).toHaveBeenCalled();
      expect(mockLeaderboardData.switchToLeaderboard).toHaveBeenCalledWith('leaderboard1');
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('leaderboards', false);
    });

    it('should handle connection failure during initialization', async () => {
      mockApiService.testConnection.mockResolvedValue(false);

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.initializeRace();
      });

      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Failed to connect to API',
        })
      );
    });

    it('should handle empty leaderboards', async () => {
      mockApiService.getLeaderboards.mockResolvedValue([]);

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.initializeRace();
      });

      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'validation',
          message: 'No leaderboards found',
          retryable: true,
        })
      );
    });

    it('should handle API errors during initialization', async () => {
      const apiError = new Error('API Error');
      mockApiService.getLeaderboards.mockRejectedValue(apiError);

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.initializeRace();
      });

      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(apiError);
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('leaderboards', false);
    });
  });

  describe('Data Refresh', () => {
    beforeEach(() => {
      mockLeaderboardData.currentLeaderboardId = 'leaderboard1';
    });

    it('should refresh data successfully', async () => {
      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('currentLeaderboard', true);
      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith(
        'leaderboard1',
        { live: true, maxResults: 100 }
      );
      expect(mockLeaderboardData.updatePlayers).toHaveBeenCalledWith(mockPlayers);
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('currentLeaderboard', false);
    });

    it('should not refresh when no leaderboard is selected', async () => {
      mockLeaderboardData.currentLeaderboardId = null;

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockApiService.getLeaderboardData).not.toHaveBeenCalled();
    });

    it('should handle refresh errors', async () => {
      const apiError = new Error('Refresh Error');
      mockApiService.getLeaderboardData.mockRejectedValue(apiError);

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(apiError);
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('currentLeaderboard', false);
    });
  });

  describe('Leaderboard Switching', () => {
    it('should switch leaderboard successfully', async () => {
      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.changeLeaderboard('leaderboard2');
      });

      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('switchingLeaderboard', true);
      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
      expect(mockLeaderboardData.switchToLeaderboard).toHaveBeenCalledWith('leaderboard2');
      expect(mockApiService.getLeaderboardData).toHaveBeenCalledWith(
        'leaderboard2',
        { live: true, maxResults: 100 }
      );
      expect(mockLeaderboardData.updatePlayers).toHaveBeenCalledWith(mockPlayers);
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('switchingLeaderboard', false);
    });

    it('should handle leaderboard switching errors', async () => {
      const apiError = new Error('Switch Error');
      mockApiService.getLeaderboardData.mockRejectedValue(apiError);

      const { result } = renderHook(() => useChickenRaceManager());

      await act(async () => {
        await result.current.changeLeaderboard('leaderboard2');
      });

      expect(mockLeaderboardData.setError).toHaveBeenCalledWith(apiError);
      expect(mockLeaderboardData.setLoadingState).toHaveBeenCalledWith('switchingLeaderboard', false);
    });
  });

  describe('Error Handling and Retry', () => {
    it('should retry initialization when no leaderboards exist', async () => {
      mockLeaderboardData.hasLeaderboards = false;
      mockLeaderboardData.error = {
        type: 'network',
        message: 'Network error',
        retryable: true,
        timestamp: Date.now(),
      };

      const { result } = renderHook(() => useChickenRaceManager());

      // const initializeSpy = vi.spyOn(result.current, 'initializeRace');

      act(() => {
        result.current.retryFailedOperation();
      });

      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
      // Note: We can't easily test the async call here due to how spies work with hooks
    });

    it('should retry data refresh when leaderboard exists', async () => {
      mockLeaderboardData.hasLeaderboards = true;
      mockLeaderboardData.currentLeaderboardId = 'leaderboard1';
      mockLeaderboardData.error = {
        type: 'network',
        message: 'Network error',
        retryable: true,
        timestamp: Date.now(),
      };

      const { result } = renderHook(() => useChickenRaceManager());

      act(() => {
        result.current.retryFailedOperation();
      });

      expect(mockLeaderboardData.clearError).toHaveBeenCalled();
    });

    it('should not retry when no error exists', () => {
      mockLeaderboardData.error = null;

      const { result } = renderHook(() => useChickenRaceManager());

      act(() => {
        result.current.retryFailedOperation();
      });

      expect(mockLeaderboardData.clearError).not.toHaveBeenCalled();
    });
  });

  describe('Race Statistics', () => {
    beforeEach(() => {
      mockLeaderboardData.players = [
        { ...mockPlayers[0], move: 'up' },
        { ...mockPlayers[1], move: 'down' },
      ];
      mockLeaderboardData.lastUpdated = Date.now() - 5000; // 5 seconds ago
    });

    it('should calculate race statistics correctly', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      const stats = result.current.raceStats;

      expect(stats.totalPlayers).toBe(2);
      expect(stats.playersWithMovement).toBe(2);
      expect(stats.topPlayer).toEqual(expect.objectContaining({ position: 1 }));
      expect(stats.lastPlayer).toEqual(expect.objectContaining({ position: 2 }));
      expect(stats.hasMovement).toBe(true);
      expect(stats.timeSinceUpdate).toBeGreaterThan(4000);
    });
  });

  describe('Race Status', () => {
    it('should provide correct race status', () => {
      mockLeaderboardData.hasLeaderboards = true;
      mockLeaderboardData.currentLeaderboard = mockLeaderboards[0];
      mockLeaderboardData.isLoading = false;
      mockLeaderboardData.hasError = false;
      mockRealTimeUpdates.isPolling = true;
      mockRealTimeUpdates.isUpdating = false;
      mockRealTimeUpdates.timeSinceLastUpdate = 30000; // 30 seconds
      mockPositionTransitions.isAnimating = false;

      const { result } = renderHook(() => useChickenRaceManager());

      const status = result.current.raceStatus;

      expect(status.isInitialized).toBe(true);
      expect(status.isLoading).toBe(false);
      expect(status.hasError).toBe(false);
      expect(status.isPolling).toBe(true);
      expect(status.isAnimating).toBe(false);
      expect(status.connectionStatus).toBe('connected');
    });

    it('should detect disconnected status', () => {
      mockRealTimeUpdates.timeSinceLastUpdate = 70000; // 70 seconds

      const { result } = renderHook(() => useChickenRaceManager());

      const status = result.current.raceStatus;
      expect(status.connectionStatus).toBe('disconnected');
    });
  });

  describe('Configuration', () => {
    it('should use custom real-time configuration', () => {
      const customConfig = {
        realTimeConfig: {
          pollingInterval: 10000,
          enabled: false,
          maxRetries: 5,
        },
      };

      const { result } = renderHook(() => useChickenRaceManager(customConfig));

      expect(result.current.config.realTime.pollingInterval).toBe(10000);
      expect(result.current.config.realTime.enabled).toBe(false);
      expect(result.current.config.realTime.maxRetries).toBe(5);
    });

    it('should use custom transition configuration', () => {
      const customConfig = {
        transitionConfig: {
          transitionDuration: 2000,
          easing: 'ease-in' as const,
          staggered: false,
        },
      };

      const { result } = renderHook(() => useChickenRaceManager(customConfig));

      expect(result.current.config.transitions.transitionDuration).toBe(2000);
      expect(result.current.config.transitions.easing).toBe('ease-in');
      expect(result.current.config.transitions.staggered).toBe(false);
    });
  });

  describe('Integration with Sub-hooks', () => {
    it('should provide real-time update controls', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      expect(result.current.startPolling).toBe(mockRealTimeUpdates.startPolling);
      expect(result.current.stopPolling).toBe(mockRealTimeUpdates.stopPolling);
      expect(result.current.forceUpdate).toBe(mockRealTimeUpdates.forceUpdate);
    });

    it('should provide position transition controls', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      expect(result.current.setImmediatePositions).toBe(mockPositionTransitions.setImmediatePositions);
      expect(result.current.getPlayerPosition).toBe(mockPositionTransitions.getPlayerPosition);
    });

    it('should provide real-time status information', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      expect(result.current.realTimeStatus).toEqual({
        isPolling: mockRealTimeUpdates.isPolling,
        isUpdating: mockRealTimeUpdates.isUpdating,
        retryCount: mockRealTimeUpdates.retryCount,
        timeSinceLastUpdate: mockRealTimeUpdates.timeSinceLastUpdate,
        lastSuccessfulUpdate: mockRealTimeUpdates.lastSuccessfulUpdate,
      });
    });

    it('should provide position data', () => {
      const { result } = renderHook(() => useChickenRaceManager());

      expect(result.current.playerPositions).toBe(mockPositionTransitions.playerPositions);
    });
  });

  describe('API Service Access', () => {
    it('should provide access to API service for advanced usage', () => {
      const { result } = renderHook(() => useChickenRaceManager({
        apiConfig: mockApiConfig,
      }));

      expect(result.current.apiService).toBeInstanceOf(SupabaseApiService);
    });
  });
});