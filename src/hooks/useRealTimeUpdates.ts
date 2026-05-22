import { useEffect, useRef, useCallback } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import { useLeaderboardData } from './useAppState';
import type { ApiError, Player } from '../types';

/**
 * Configuration for real-time updates
 */
interface RealTimeConfig {
  /** Polling interval in milliseconds (default: 30 seconds) */
  pollingInterval?: number;
  /** Whether to enable real-time updates (default: true) */
  enabled?: boolean;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Whether to pause updates when the tab is not visible (default: true) */
  pauseOnHidden?: boolean;
}

/**
 * Hook for managing real-time data updates with configurable polling intervals,
 * error handling, and retry logic with exponential backoff.
 */
export const useRealTimeUpdates = (
  apiService: SupabaseApiService,
  config: RealTimeConfig = {}
) => {
  const {
    pollingInterval = 30000, // 30 seconds default
    enabled = true,
    maxRetries = 3,
    retryDelay = 1000,
    pauseOnHidden = true,
  } = config;

  const {
    currentLeaderboardId,
    players,
    updatePlayers,
    // setLoadingState, // Currently unused but may be needed for future features
    setError,
    clearError,
    // lastUpdated, // Currently unused but may be needed for future features
  } = useLeaderboardData();

  // Refs for managing intervals and retry state
  const intervalRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const isUpdatingRef = useRef(false);
  const lastSuccessfulUpdateRef = useRef<number>(0);

  /**
   * Calculate retry delay with exponential backoff
   */
  const getRetryDelay = useCallback((attempt: number): number => {
    return retryDelay * Math.pow(2, attempt - 1);
  }, [retryDelay]);

  /**
   * Compare players arrays to detect changes and calculate smooth transitions
   */
  const calculatePlayerChanges = useCallback((
    oldPlayers: Player[],
    newPlayers: Player[]
  ): { hasChanges: boolean; changedPlayers: Player[] } => {
    if (oldPlayers.length !== newPlayers.length) {
      return { hasChanges: true, changedPlayers: newPlayers };
    }

    const changedPlayers: Player[] = [];
    let hasChanges = false;

    newPlayers.forEach((newPlayer) => {
      const oldPlayer = oldPlayers.find(p => p._id === newPlayer._id);
      
      if (!oldPlayer) {
        // New player
        hasChanges = true;
        changedPlayers.push(newPlayer);
      } else if (
        oldPlayer.position !== newPlayer.position ||
        oldPlayer.total !== newPlayer.total
      ) {
        // Player position or score changed
        hasChanges = true;
        
        // Calculate movement direction
        const move = oldPlayer.position > newPlayer.position ? 'up' :
                    oldPlayer.position < newPlayer.position ? 'down' : 'same';
        
        changedPlayers.push({
          ...newPlayer,
          previous_position: oldPlayer.position,
          previous_total: oldPlayer.total,
          move,
        });
      } else {
        // No changes, keep existing data
        changedPlayers.push(newPlayer);
      }
    });

    return { hasChanges, changedPlayers };
  }, []);

  /**
   * Fetch fresh leaderboard data with error handling
   */
  const fetchLeaderboardData = useCallback(async (): Promise<void> => {
    if (!currentLeaderboardId || isUpdatingRef.current) {
      return;
    }

    isUpdatingRef.current = true;

    try {
      // Clear any existing errors
      clearError();

      // Fetch new data
      const response = await apiService.getLeaderboardData(currentLeaderboardId, {
        live: true,
        maxResults: 100, // Reasonable limit for performance
      });

      // Calculate changes and smooth transitions
      const { hasChanges, changedPlayers } = calculatePlayerChanges(
        players,
        response.leaders
      );

      if (hasChanges) {
        // Use setTimeout to avoid state updates during render
        setTimeout(() => {
          updatePlayers(changedPlayers);
        }, 0);
      }

      // Reset retry count on successful update
      retryCountRef.current = 0;
      lastSuccessfulUpdateRef.current = Date.now();

    } catch (error) {
      console.error('Failed to fetch leaderboard data:', error);
      
      const apiError = error as ApiError;
      
      // Only retry if the error is retryable and we haven't exceeded max retries
      if (apiError.retryable && retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        const delay = getRetryDelay(retryCountRef.current);
        
        console.log(`Retrying in ${delay}ms (attempt ${retryCountRef.current}/${maxRetries})`);
        
        retryTimeoutRef.current = window.setTimeout(() => {
          fetchLeaderboardData();
        }, delay);
      } else {
        // Set error state for non-retryable errors or max retries exceeded - use setTimeout to avoid render issues
        setTimeout(() => {
          setError(apiError);
        }, 0);
        retryCountRef.current = 0; // Reset for next polling cycle
      }
    } finally {
      isUpdatingRef.current = false;
    }
  }, [
    currentLeaderboardId,
    players,
    apiService,
    maxRetries,
    getRetryDelay,
    calculatePlayerChanges,
    updatePlayers,
    setError,
    clearError,
  ]);

  /**
   * Start periodic polling
   */
  const startPolling = useCallback(() => {
    if (intervalRef.current || !enabled || !currentLeaderboardId) {
      return;
    }

    // Initial fetch
    fetchLeaderboardData();

    // Set up periodic polling
    intervalRef.current = window.setInterval(() => {
      // Skip if tab is hidden and pauseOnHidden is enabled
      if (pauseOnHidden && document.hidden) {
        return;
      }

      fetchLeaderboardData();
    }, pollingInterval);

  }, [enabled, currentLeaderboardId, pollingInterval, pauseOnHidden, fetchLeaderboardData]);

  /**
   * Stop periodic polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    retryCountRef.current = 0;
    isUpdatingRef.current = false;
  }, []);

  /**
   * Force an immediate update
   */
  const forceUpdate = useCallback(() => {
    if (!isUpdatingRef.current) {
      fetchLeaderboardData();
    }
  }, [fetchLeaderboardData]);

  /**
   * Handle visibility change to pause/resume updates
   */
  const handleVisibilityChange = useCallback(() => {
    if (!pauseOnHidden) return;

    if (document.hidden) {
      // Tab became hidden - polling will be skipped but interval continues
      console.log('Tab hidden, pausing real-time updates');
    } else {
      // Tab became visible - force an immediate update to catch up
      console.log('Tab visible, resuming real-time updates');
      if (enabled && currentLeaderboardId) {
        forceUpdate();
      }
    }
  }, [pauseOnHidden, enabled, currentLeaderboardId, forceUpdate]);

  // Set up polling when leaderboard changes or config changes
  useEffect(() => {
    stopPolling(); // Clean up existing polling
    
    if (enabled && currentLeaderboardId) {
      startPolling();
    }

    return stopPolling;
  }, [enabled, currentLeaderboardId, pollingInterval, startPolling, stopPolling]);

  // Set up visibility change listener
  useEffect(() => {
    if (pauseOnHidden) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [pauseOnHidden, handleVisibilityChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Calculate time since last successful update
  const timeSinceLastUpdate = lastSuccessfulUpdateRef.current > 0 
    ? Date.now() - lastSuccessfulUpdateRef.current 
    : 0;

  return {
    // State
    isPolling: intervalRef.current !== null,
    isUpdating: isUpdatingRef.current,
    retryCount: retryCountRef.current,
    timeSinceLastUpdate,
    lastSuccessfulUpdate: lastSuccessfulUpdateRef.current,
    
    // Actions
    startPolling,
    stopPolling,
    forceUpdate,
    
    // Configuration
    config: {
      pollingInterval,
      enabled,
      maxRetries,
      retryDelay,
      pauseOnHidden,
    },
  };
};

/**
 * Hook for managing real-time updates with loading states
 * This is a higher-level hook that integrates with the UI loading states
 */
export const useRealTimeUpdatesWithLoading = (
  apiService: FunifierApiService,
  config: RealTimeConfig = {}
) => {
  const { setLoadingState } = useLeaderboardData();
  const realTimeUpdates = useRealTimeUpdates(apiService, config);

  // Update loading state based on update status - use useEffect to avoid render-time updates
  useEffect(() => {
    // Use setTimeout to ensure this runs after render
    const timeoutId = setTimeout(() => {
      setLoadingState('currentLeaderboard', realTimeUpdates.isUpdating);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [realTimeUpdates.isUpdating, setLoadingState]);

  return realTimeUpdates;
};