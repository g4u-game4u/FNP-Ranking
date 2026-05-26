import { useState, useCallback, useEffect } from 'react';
import { useChickenRaceManager } from './hooks/useChickenRaceManager';
import { ChickenRace } from './components/ChickenRace';
import { Sidebar } from './components/Sidebar';
import { LazyDetailedRanking } from './components/LazyDetailedRanking';
import { LeaderboardSelector } from './components/LeaderboardSelector';
import { FloatingErrorDisplay } from './components/ErrorDisplay';
import { LoadingDisplay, OverlayLoading } from './components/LoadingDisplay';
import { DailyGoalProgress } from './components/DailyGoalProgress';
// import { DailyCodeCard } from './components/DailyCodeCard';
import { ChallengeNotificationDisplay } from './components/ChallengeNotificationDisplay';
import { globalPreloadingService } from './services/preloadingService';
import { initializeAdaptivePreloading } from './utils/lazyLoading';
import { globalPerformanceMonitor } from './utils/performanceMonitor';
import { globalResourceOptimizer } from './utils/resourceOptimizer';
import { globalRaspberryPiOptimizationManager } from './utils/initializeRaspberryPiOptimizations';
import { ResponsiveWrapper } from './components/ResponsiveWrapper';
import { KioskModeProvider } from './components/KioskModeProvider';
import { initializeSecurity } from './utils/securityInit';
// import ChickenRaceExample from './components/examples/ChickenRaceExample';
import type { SupabaseConfig } from './types';

function App() {
  const [showDemo, setShowDemo] = useState(false);
  const [forceDemo, setForceDemo] = useState(false);
  
  // Initialize performance monitoring and preloading for Raspberry Pi optimization
  useEffect(() => {
    const initializeOptimizations = async () => {
      try {
        // Initialize security measures for kiosk deployment
        initializeSecurity();
        
        // Initialize comprehensive Raspberry Pi optimizations
        await globalRaspberryPiOptimizationManager.initialize();
        
        // Performance monitor initializes automatically
        // Just trigger initial optimization check
        globalPerformanceMonitor.triggerOptimizations();
        
        // Start resource optimization monitoring (handled by Raspberry Pi manager)
        // globalResourceOptimizer.startMonitoring();
        
        // Initialize adaptive preloading
        initializeAdaptivePreloading();
        
        // Initialize intelligent preloading service
        await globalPreloadingService.initialize();
        
        console.log('🚀 All optimizations initialized successfully');
      } catch (error) {
        console.warn('⚠️ Failed to initialize some optimizations:', error);
      }
    };

    initializeOptimizations();

    // Cleanup on unmount
    return () => {
      globalRaspberryPiOptimizationManager.destroy();
    };
  }, []);
  
  // Get API config from environment, allowing null for demo mode fallback
  const [apiConfig] = useState<SupabaseConfig | null>(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      console.warn('🔧 Missing Supabase configuration, will use demo mode');
      return null;
    }

    return {
      url,
      anonKey,
    };
  });

  // API configuration loaded (debug logging removed for security)

  // Stable callback to prevent infinite loops
  const handleAuthError = useCallback(() => {
    console.warn('🔐 Authentication error detected, switching to demo mode');
    setForceDemo(true);
  }, []);

  const {
    // State
    leaderboards,
    currentLeaderboard,
    players,
    loading,
    error,
    usingMockData,
    
    // Status
    raceStatus,
    playerPositions,
    
    // Actions
    initializeRace,
    changeLeaderboard,
    retryFailedOperation,
    clearError,
    
    // API Service
    apiService,
  } = useChickenRaceManager({
    apiConfig: apiConfig || undefined,
    realTimeConfig: {
      pollingInterval: 30000, // 30 seconds
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
    onAuthError: handleAuthError,
  });

  // Show demo if no API config is provided or auth error occurred
  if (showDemo || forceDemo || !apiConfig) {
    return "Demo Example";
    // return (
    //   <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600">
    //     <div className="container mx-auto py-8">
    //       {/* Demo Mode Banner */}
    //       <div className="bg-yellow-500/90 backdrop-blur-sm border-b border-yellow-400/50 mb-6 rounded-lg mx-4">
    //         <div className="px-4 py-3">
    //           <div className="flex items-center justify-center text-center">
    //             <div className="flex items-center space-x-2">
    //               <span className="text-yellow-900 text-lg">🎮</span>
    //               <span className="text-yellow-900 font-medium">
    //                 Modo Demo: {!apiConfig ? 'Configuração da API não encontrada' : 'Falha na conexão com a API'}
    //               </span>
    //               {(forceDemo || !apiConfig) && (
    //                 <button
    //                   onClick={() => window.location.reload()}
    //                   className="ml-4 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors"
    //                 >
    //                   Recarregar App
    //                 </button>
    //               )}
    //             </div>
    //           </div>
    //         </div>
    //       </div>
          
    //       <ChickenRaceExample />
    //     </div>
    //   </div>
    // );
  }

  return (
    <KioskModeProvider enableAutoOptimization={true}>
      <ResponsiveWrapper enableAutoDetection={true}>
        <div className="min-h-screen bg-gradient-to-br from-green-400 via-blue-500 to-purple-600">
          {/* Floating Error Display */}
          <FloatingErrorDisplay
            error={error}
            onRetry={retryFailedOperation}
            onDismiss={clearError}
          />

          {/* Header */}
          <header className="bg-white/10 backdrop-blur-sm border-b border-white/20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center space-x-2 sm:space-x-4">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white responsive-text">
                    🐔 Ranking do Game FNP
                  </h1>
                  {raceStatus.connectionStatus && (
                    <div className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium responsive-text ${
                      raceStatus.connectionStatus === 'connected' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full mr-1 sm:mr-2 ${
                        raceStatus.connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <span className="hidden sm:inline">{raceStatus.connectionStatus === 'connected' ? 'conectado' : 'desconectado'}</span>
                      <span className="sm:hidden">{raceStatus.connectionStatus === 'connected' ? '✓' : '✗'}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
                  {/* Leaderboard Selector */}
                  {leaderboards.length > 0 && (
                    <div className="w-full sm:w-auto">
                      <LeaderboardSelector
                        onLeaderboardChange={changeLeaderboard}
                      />
                    </div>
                  )}

                  <button
                    onClick={() => setShowDemo(true)}
                    className="px-3 sm:px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors text-sm sm:text-base responsive-button touch-target"
                  >
                    <span className="sm:hidden">Demo</span>
                    <span className="hidden sm:inline">Modo Demo</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

        {/* Mock Data Warning Banner */}
        {usingMockData && (
          <div className="bg-yellow-500/90 backdrop-blur-sm border-b border-yellow-400/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center justify-center text-center">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-900 text-lg">⚠️</span>
                  <span className="text-yellow-900 font-medium text-sm sm:text-base responsive-text">
                    Modo Demo: Mostrando dados simulados devido a problemas de conexão com a API
                  </span>
                  <button
                    onClick={retryFailedOperation}
                    className="ml-4 px-3 py-1 bg-yellow-600 text-white text-xs rounded hover:bg-yellow-700 transition-colors responsive-button touch-target"
                  >
                    Tentar API
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 responsive-container">
          {!raceStatus.isInitialized && !raceStatus.isLoading ? (
            /* Welcome Screen */
            <div className="text-center py-20">
              <div className="text-white/80 text-8xl mb-8">🐔</div>
              <h2 className="text-4xl font-bold text-white mb-4 responsive-text">
                Bem-vindo ao Game FNP!
              </h2>
              <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto responsive-text">
                Transforme seus rankings em uma experiência envolvente e animada de corrida de galinhas. 
                Assista os jogadores competirem em tempo real com animações suaves e atualizações ao vivo.
              </p>
              <div className="space-y-4 responsive-spacing">
                <button
                  onClick={initializeRace}
                  disabled={loading.leaderboards}
                  className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors responsive-button touch-target"
                >
                  {loading.leaderboards ? 'Inicializando...' : 'Começar a Corrida!'}
                </button>
                <div>
                  <button
                    onClick={() => setShowDemo(true)}
                    className="text-white/80 hover:text-white underline responsive-text touch-target"
                  >
                    Ou experimente a demonstração interativa
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Race Interface */
            <div className="space-y-8 responsive-spacing">
              {/* Loading Overlay */}
              {loading.leaderboards && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-8 max-w-md mx-4 responsive-modal">
                    <LoadingDisplay
                      loading={loading}
                      variant="spinner"
                      size="large"
                    />
                  </div>
                </div>
              )}

              {/* Race Visualization */}
              <div className="flex flex-col lg:grid lg:grid-cols-4 gap-4 lg:gap-8 responsive-grid">
                {/* Main Race Area */}
                <div className="lg:col-span-3 relative order-2 lg:order-1">
                  <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 sm:p-6 border border-white/20 responsive-card">
                    {currentLeaderboard && (
                      <div className="mb-4">
                        <h2 className="text-lg sm:text-xl font-semibold text-white mb-2 responsive-text">
                          {currentLeaderboard.title}
                        </h2>
                        <p className="text-white/80 text-xs sm:text-sm responsive-text">
                          {currentLeaderboard.description}
                        </p>
                      </div>
                    )}

                    <ChickenRace
                      players={players}
                      leaderboardTitle={currentLeaderboard?.title || ''}
                      isLoading={loading.currentLeaderboard}
                      playerPositions={playerPositions}
                    />

                    {/* Switching Overlay */}
                    {loading.switchingLeaderboard && (
                      <OverlayLoading
                        loading={loading}
                        message="Trocando ranking..."
                      />
                    )}
                  </div>
                </div>

                {/* Sidebar - Mobile: Top, Desktop: Right */}
                <div className="lg:col-span-1 order-1 lg:order-2 flex">
                  <Sidebar
                    topPlayers={players.slice(0, 5)}
                    currentLeaderboard={currentLeaderboard}
                    totalPlayers={players.length}
                    isLoading={loading.currentLeaderboard}
                  />
                </div>
              </div>

              {/* Daily Goal Progress */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 responsive-card">
                <DailyGoalProgress 
                  apiService={apiService}
                  playerId="dummy@grupo4u.com.br"
                  challengeId="E81QYFG"
                  current={39000}
                  target={50000}
                />
              </div>

              {/* Detailed Ranking - Lazy Loaded */}
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 responsive-card">
                <LazyDetailedRanking
                  players={players}
                  currentLeaderboard={currentLeaderboard}
                  isLoading={loading.currentLeaderboard}
                />
              </div>
            </div>
          )}
        </main>

        {/* Daily Code Card - Fixed position at bottom-left */}
        {/* <DailyCodeCard /> */}

        {/* Challenge Completion Notifications */}
        <ChallengeNotificationDisplay
          showConnectionStatus={false}
          showErrors={true}
          position="top-right"
        />
      </div>
    </ResponsiveWrapper>
  </KioskModeProvider>
  );
}

export default App;
