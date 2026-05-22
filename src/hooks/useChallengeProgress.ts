import { useState, useEffect, useCallback, useRef } from 'react';
import { SupabaseApiService } from '../services/supabaseApi';
import type { PlayerStatus, ChallengeProgress, ApiError } from '../types';

interface ChallengeProgressState {
  progress: number;
  current: number;
  target: number;
  isCompleted: boolean;
  challengeName: string;
  loading: boolean;
  error: ApiError | null;
}

interface UseChallengeProgressOptions {
  apiService: SupabaseApiService | null;
  playerId: string;
  challengeId: string;
  refreshInterval?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch and manage challenge progress for a specific player and challenge
 */
export const useChallengeProgress = ({
  apiService,
  playerId,
  challengeId,
  refreshInterval = 30000, // 30 seconds default
  enabled = true,
}: UseChallengeProgressOptions) => {
  const [state, setState] = useState<ChallengeProgressState>({
    progress: 0,
    current: 0,
    target: 0,
    isCompleted: false,
    challengeName: '',
    loading: true,
    error: null,
  });

  // Use refs to avoid dependency loops
  const apiServiceRef = useRef(apiService);
  const playerIdRef = useRef(playerId);
  const challengeIdRef = useRef(challengeId);
  const enabledRef = useRef(enabled);

  // Update refs when values change
  useEffect(() => {
    apiServiceRef.current = apiService;
    playerIdRef.current = playerId;
    challengeIdRef.current = challengeId;
    enabledRef.current = enabled;
  }, [apiService, playerId, challengeId, enabled]);

  const fetchChallengeProgress = useCallback(async () => {
    const currentApiService = apiServiceRef.current;
    const currentPlayerId = playerIdRef.current;
    const currentChallengeId = challengeIdRef.current;
    const currentEnabled = enabledRef.current;

    if (!currentApiService || !currentEnabled) {
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      const playerStatus: PlayerStatus = await currentApiService.getPlayerStatus(currentPlayerId);
      
      // Check if challenge is completed (in challenges object)
      const completedChallenges = playerStatus.challenges || {};
      if (completedChallenges[currentChallengeId]) {
        setState({
          progress: 100,
          current: completedChallenges[currentChallengeId],
          target: completedChallenges[currentChallengeId],
          isCompleted: true,
          challengeName: 'Meta Diária', // Default name, could be enhanced
          loading: false,
          error: null,
        });
        return;
      }

      // Look for challenge in progress
      const challengeProgress = playerStatus.challenge_progress?.find(
        (cp: ChallengeProgress) => cp.challenge === currentChallengeId
      );

      if (challengeProgress) {
        // Get the first rule (assuming single rule challenges for daily goals)
        const rule = challengeProgress.rules[0];
        
        setState({
          progress: challengeProgress.percent_completed,
          current: rule?.times_completed || 0,
          target: rule?.times_required || 0,
          isCompleted: rule?.completed || false,
          challengeName: challengeProgress.name,
          loading: false,
          error: null,
        });
      } else {
        // Challenge not found, set default values
        setState({
          progress: 0,
          current: 0,
          target: 50000, // Default target
          isCompleted: false,
          challengeName: 'Meta Diária',
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Failed to fetch challenge progress:', error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as ApiError,
      }));
    }
  }, []); // Empty dependency array since we use refs

  const retry = useCallback(() => {
    fetchChallengeProgress();
  }, [fetchChallengeProgress]);

  // Initial fetch - only run when key dependencies change
  useEffect(() => {
    fetchChallengeProgress();
  }, [apiService, playerId, challengeId, enabled]);

  // Set up polling interval
  useEffect(() => {
    if (!enabled || !refreshInterval || !apiService) {
      return;
    }

    const interval = setInterval(fetchChallengeProgress, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchChallengeProgress, refreshInterval, enabled, apiService]);

  return {
    ...state,
    refresh: fetchChallengeProgress,
    retry,
  };
};