import React, { useState, useEffect } from 'react';
import { useChallengeProgress } from '../hooks/useChallengeProgress';
import type { SupabaseApiService } from '../services/supabaseApi';

interface DailyGoalProgressProps {
  apiService?: SupabaseApiService | null;
  playerId?: string;
  challengeId?: string;
  current?: number;
  target?: number;
  className?: string;
}

export const DailyGoalProgress: React.FC<DailyGoalProgressProps> = ({
  apiService,
  playerId,
  challengeId = 'E81QYFG',
  current: fallbackCurrent = 39000,
  target: fallbackTarget = 50000,
  className = '',
}) => {
  const [topPlayerProgress, setTopPlayerProgress] = useState<{
    playerId: string;
    progress: number;
    current: number;
    target: number;
  } | null>(null);

  // Use dynamic data if API service is available AND we have a valid playerId, otherwise fall back to props
  const challengeData = useChallengeProgress({
    apiService: apiService || null,
    playerId: playerId || '',
    challengeId,
    enabled: !!apiService && !!playerId,
  });

  // Fetch all players' progress to find the one with highest percentage
  useEffect(() => {
    const fetchTopPlayerProgress = async () => {
      if (!apiService) return;

      try {
        // Get all players from the leaderboard
        const leaderboards = await apiService.getLeaderboards();
        if (!leaderboards || leaderboards.length === 0) return;

        // Get the first leaderboard's players
        const firstLeaderboard = leaderboards[0];
        const players = await apiService.getLeaderboardPlayers(firstLeaderboard.id);
        if (!players || players.length === 0) return;

        // Fetch challenge progress for each player and find the highest
        let maxProgress = 0;
        let topPlayer = null;

        for (const player of players.slice(0, 10)) { // Check top 10 players only for performance
          try {
            const playerStatus = await apiService.getPlayerStatus(player.id);
            const challengeProgress = playerStatus.challenge_progress?.find(
              (cp: any) => cp.challenge === challengeId
            );

            if (challengeProgress && challengeProgress.percent_completed > maxProgress) {
              maxProgress = challengeProgress.percent_completed;
              const rule = challengeProgress.rules[0];
              topPlayer = {
                playerId: player.id,
                progress: challengeProgress.percent_completed,
                current: rule?.times_completed || 0,
                target: rule?.times_required || 0,
              };
            }
          } catch (error) {
            // Skip players that fail
            continue;
          }
        }

        if (topPlayer) {
          setTopPlayerProgress(topPlayer);
        }
      } catch (error) {
        console.error('Failed to fetch top player progress:', error);
      }
    };

    if (apiService) {
      fetchTopPlayerProgress();
      // Refresh every 60 seconds (reduced frequency to avoid hammering the API)
      const interval = setInterval(fetchTopPlayerProgress, 60000);
      return () => clearInterval(interval);
    }
  }, [apiService, challengeId]);

  // Determine values to use (top player or fallback)
  const current = topPlayerProgress?.current ?? (apiService ? challengeData.current : fallbackCurrent);
  const target = topPlayerProgress?.target ?? (apiService ? challengeData.target : fallbackTarget);
  const progressPercentage = topPlayerProgress?.progress ?? (apiService ? challengeData.progress : Math.min((fallbackCurrent / fallbackTarget) * 100, 100));
  const challengeName = apiService ? challengeData.challengeName : 'Meta Diária';
  const isLoading = apiService ? challengeData.loading : false;
  const hasError = apiService ? !!challengeData.error : false;
  
  // Format numbers for display
  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  // Determine progress color based on percentage
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  // Determine text color for contrast
  const getTextColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-green-700';
    if (percentage >= 70) return 'text-yellow-700';
    if (percentage >= 50) return 'text-orange-700';
    return 'text-red-700';
  };

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-4 sm:p-6 border border-white/20 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg sm:text-xl font-bold text-gray-800 flex items-center gap-2">
          🎯 {challengeName}
          {topPlayerProgress && (
            <span className="text-xs text-gray-500">(Líder)</span>
          )}
          {isLoading && <span className="text-xs text-gray-500 animate-pulse">Atualizando...</span>}
          {hasError && <span className="text-xs text-red-500">⚠️</span>}
        </h3>
        <div className={`text-sm sm:text-base font-semibold ${getTextColor(progressPercentage)}`}>
          {progressPercentage.toFixed(1)}%
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="w-full bg-gray-200 rounded-full h-4 sm:h-6 overflow-hidden">
          <div
            className={`h-full ${getProgressColor(progressPercentage)} transition-all duration-1000 ease-out rounded-full relative`}
            style={{ width: `${progressPercentage}%` }}
          >
            {/* Progress bar shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Progress Details */}
      <div className="flex items-center justify-between text-sm sm:text-base">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <div className="text-gray-600">
            <span className="font-medium text-gray-800">{formatNumber(current)}</span>
            <span className="text-gray-500"> / {formatNumber(target)}</span>
          </div>
          {progressPercentage < 100 && (
            <div className="text-gray-500 text-xs sm:text-sm">
              Restam: <span className="font-medium text-gray-700">{formatNumber(target - current)}</span>
            </div>
          )}
        </div>
        
        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {progressPercentage >= 100 ? (
            <span className="text-green-600 text-lg">✅</span>
          ) : progressPercentage >= 90 ? (
            <span className="text-yellow-600 text-lg">⚡</span>
          ) : progressPercentage >= 50 ? (
            <span className="text-orange-600 text-lg">🔥</span>
          ) : (
            <span className="text-red-600 text-lg">⏰</span>
          )}
        </div>
      </div>

      {/* Motivational message */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs sm:text-sm text-gray-600 text-center">
          {hasError ? (
            <span className="text-red-600 font-medium">
              ⚠️ Erro ao carregar dados. 
              {apiService && (
                <button 
                  onClick={challengeData.retry}
                  className="ml-1 underline hover:no-underline"
                >
                  Tentar novamente
                </button>
              )}
            </span>
          ) : progressPercentage >= 100 ? (
            <span className="text-green-600 font-medium">🎉 Meta alcançada! Parabéns!</span>
          ) : progressPercentage >= 90 ? (
            <span className="text-yellow-600 font-medium">🚀 Quase lá! Falta pouco!</span>
          ) : progressPercentage >= 70 ? (
            <span className="text-orange-600 font-medium">💪 Bom progresso! Continue assim!</span>
          ) : progressPercentage >= 50 ? (
            <span className="text-orange-600 font-medium">📈 No meio do caminho!</span>
          ) : (
            <span className="text-red-600 font-medium">🎯 Vamos acelerar o ritmo!</span>
          )}
        </p>
        {apiService && !hasError && (
          <p className="text-xs text-gray-400 text-center mt-1">
            {topPlayerProgress ? 'Mostrando progresso do líder' : 'Dados atualizados automaticamente'}
          </p>
        )}
      </div>
    </div>
  );
};

export default DailyGoalProgress;