import React from 'react';

interface DailyGoalProgressProps {
  current: number;
  target: number;
  goalMet: boolean;
  className?: string;
}

export const DailyGoalProgress: React.FC<DailyGoalProgressProps> = ({
  current,
  target,
  goalMet,
  className = '',
}) => {
  const progressPercentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const formatNumber = (num: number): string => {
    return num.toLocaleString('pt-BR');
  };

  const getProgressColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

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
          🎯 Meta Diária
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
          {!goalMet && (
            <div className="text-gray-500 text-xs sm:text-sm">
              Restam: <span className="font-medium text-gray-700">{formatNumber(target - current)}</span>
            </div>
          )}
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-1">
          {goalMet ? (
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
          {goalMet ? (
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
      </div>
    </div>
  );
};

export default DailyGoalProgress;
