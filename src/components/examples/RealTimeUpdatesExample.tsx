import React, { useState } from 'react';
import { useChickenRaceManager } from '../../hooks/useChickenRaceManager';
import { ErrorDisplay } from '../ErrorDisplay';
import { LoadingDisplay, OverlayLoading } from '../LoadingDisplay';
import type { SupabaseConfig } from '../../types';

/**
 * Example component demonstrating real-time updates and error handling
 */
export const RealTimeUpdatesExample: React.FC = () => {
  const [apiConfig, setApiConfig] = useState<SupabaseConfig>({
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key',
  });

  const {
    // State
    leaderboards,
    currentLeaderboard,
    players,
    loading,
    error,
    lastUpdated,
    
    // Status
    raceStatus,
    realTimeStatus,
    
    // Actions
    initializeRace,
    refreshData,
    changeLeaderboard,
    retryFailedOperation,
    clearError,
    
    // Real-time controls
    startPolling,
    stopPolling,
    forceUpdate,
  } = useChickenRaceManager({
    apiConfig,
    realTimeConfig: {
      pollingInterval: 10000, // 10 seconds for demo
      enabled: true,
      maxRetries: 3,
      retryDelay: 1000,
      pauseOnHidden: true,
    },
    transitionConfig: {
      transitionDuration: 1000,
      easing: 'ease-out',
      staggered: true,
      staggerDelay: 100,
      celebrateImprovements: true,
    },
  });

  const handleConfigChange = (field: keyof SupabaseConfig, value: string) => {
    setApiConfig(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatLastUpdated = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Real-Time Updates Demo
        </h1>

        {/* Configuration Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            API Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Server URL
              </label>
              <input
                type="text"
                value={apiConfig.serverUrl}
                onChange={(e) => handleConfigChange('serverUrl', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key
              </label>
              <input
                type="text"
                value={apiConfig.apiKey}
                onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Auth Token
              </label>
              <input
                type="password"
                value={apiConfig.authToken}
                onChange={(e) => handleConfigChange('authToken', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={initializeRace}
            disabled={loading.leaderboards}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Initialize Race
          </button>
          <button
            onClick={refreshData}
            disabled={!currentLeaderboard || loading.currentLeaderboard}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Refresh Data
          </button>
          <button
            onClick={forceUpdate}
            disabled={!currentLeaderboard || realTimeStatus.isUpdating}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Force Update
          </button>
          {realTimeStatus.isPolling ? (
            <button
              onClick={stopPolling}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Stop Polling
            </button>
          ) : (
            <button
              onClick={startPolling}
              disabled={!currentLeaderboard}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Polling
            </button>
          )}
        </div>

        {/* Status Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Connection Status</h3>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              raceStatus.connectionStatus === 'connected' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                raceStatus.connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
              }`} />
              {raceStatus.connectionStatus}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Polling Status</h3>
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              realTimeStatus.isPolling 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {realTimeStatus.isPolling ? 'Active' : 'Inactive'}
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Last Updated</h3>
            <p className="text-sm text-gray-600">
              {formatLastUpdated(lastUpdated)}
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Retry Count</h3>
            <p className="text-sm text-gray-600">
              {realTimeStatus.retryCount}
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <ErrorDisplay
              error={error}
              onRetry={retryFailedOperation}
              onDismiss={clearError}
              size="medium"
            />
          </div>
        )}

        {/* Loading Display */}
        <div className="mb-6">
          <LoadingDisplay
            loading={loading}
            variant="spinner"
            size="medium"
          />
        </div>

        {/* Leaderboard Selector */}
        {leaderboards.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Available Leaderboards ({leaderboards.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {leaderboards.map((leaderboard) => (
                <button
                  key={leaderboard._id}
                  onClick={() => changeLeaderboard(leaderboard._id)}
                  disabled={loading.switchingLeaderboard}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    currentLeaderboard?._id === leaderboard._id
                      ? 'border-blue-500 bg-blue-50 text-blue-900'
                      : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="font-medium">{leaderboard.title}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {leaderboard.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Players List */}
        {players.length > 0 && (
          <div className="relative">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">
              Current Players ({players.length})
            </h3>
            
            {/* Overlay loading for switching leaderboards */}
            {loading.switchingLeaderboard && (
              <OverlayLoading
                loading={loading}
                message="Switching leaderboard..."
              />
            )}
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {players.slice(0, 12).map((player) => (
                  <div
                    key={player._id}
                    className={`p-3 bg-white rounded-lg border ${
                      player.move === 'up' 
                        ? 'border-green-300 bg-green-50' 
                        : player.move === 'down'
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          #{player.position} {player.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {player.total} points
                        </div>
                      </div>
                      {player.move && player.move !== 'same' && (
                        <div className={`text-xs px-2 py-1 rounded-full ${
                          player.move === 'up' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {player.move === 'up' ? '↑' : '↓'}
                          {player.previous_position && (
                            <span className="ml-1">
                              {Math.abs(player.position - player.previous_position)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {players.length > 12 && (
                <div className="mt-3 text-center text-sm text-gray-600">
                  ... and {players.length - 12} more players
                </div>
              )}
            </div>
          </div>
        )}

        {/* No Data State */}
        {!raceStatus.isInitialized && !raceStatus.isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">🐔</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Race Data
            </h3>
            <p className="text-gray-600 mb-4">
              Initialize the race to start fetching leaderboard data
            </p>
            <button
              onClick={initializeRace}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Initialize Race
            </button>
          </div>
        )}
      </div>
    </div>
  );
};