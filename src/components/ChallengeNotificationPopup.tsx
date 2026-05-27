/**
 * Challenge Notification Popup Component
 * 
 * Displays popup notifications when players complete challenges.
 * Features celebratory visual elements, responsive design, and kiosk mode compatibility.
 * Includes smooth entrance/exit animations and configurable automatic dismissal timing.
 * Enhanced with comprehensive error handling and graceful degradation.
 */

import React, { useEffect, useState, useCallback, ErrorInfo } from 'react';
import type { ChallengeCompletionEvent } from '../services/sseClientService';
import { useDisplayConfig } from '../hooks/useChallengeNotificationConfig';
import { challengeNotificationErrorHandler } from '../services/challengeNotificationErrorHandler';
import { 
  createRenderingError, 
  safeDOMOperation,
  withSyncNotificationErrorHandling 
} from '../utils/challengeNotificationErrorUtils';

export interface ChallengeNotificationPopupProps {
  notification: ChallengeCompletionEvent;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'center';
  onDismiss: () => void;
}

/**
 * Error Boundary for Challenge Notification Popup
 */
class ChallengeNotificationErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: ErrorInfo) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error through the error handler
    const renderingError = createRenderingError(
      'ChallengeNotificationPopup',
      'render',
      error,
      { errorInfo }
    );
    challengeNotificationErrorHandler.handleError(renderingError);
    
    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI for rendering errors
      return (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-300 rounded-lg p-4 max-w-sm">
          <div className="flex items-center gap-2 text-red-800">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-medium">Notification Error</p>
              <p className="text-sm">Unable to display notification</p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export interface ChallengeNotificationPopupProps {
  notification: ChallengeCompletionEvent;
  duration?: number;
  position?: 'top-right' | 'top-center' | 'center';
  onDismiss: () => void;
}

export const ChallengeNotificationPopup: React.FC<ChallengeNotificationPopupProps> = ({
  notification,
  duration: propDuration,
  position: propPosition,
  onDismiss
}) => {
  const [animationState, setAnimationState] = useState<'entering' | 'visible' | 'exiting'>('entering');
  const [renderingError, setRenderingError] = useState<string | null>(null);
  
  // Safely get configuration with error handling
  const safeGetDisplayConfig = withSyncNotificationErrorHandling(
    () => useDisplayConfig(),
    'rendering',
    'CONFIG_ACCESS_ERROR',
    (error) => {
      challengeNotificationErrorHandler.handleError(error);
      setRenderingError('Configuration error');
    }
  );
  
  const config = safeGetDisplayConfig();
  const { displayDuration, position: configPosition, animationConfig } = config || {
    displayDuration: 4000,
    position: 'top-right' as const,
    animationConfig: {
      enterDuration: 300,
      exitDuration: 300,
      enterEasing: 'ease-out',
      exitEasing: 'ease-in'
    }
  };
  
  // Use prop values if provided, otherwise use config values
  const duration = propDuration ?? displayDuration;
  const position = propPosition ?? configPosition;

  // Safely handle entrance animation
  useEffect(() => {
    const safeSetAnimationState = safeDOMOperation(
      () => {
        const enterTimer = setTimeout(() => {
          setAnimationState('visible');
        }, 50);
        return enterTimer;
      },
      'entrance animation setup',
      (error) => {
        challengeNotificationErrorHandler.handleError(error);
        setRenderingError('Animation error');
      }
    );

    const enterTimer = safeSetAnimationState;
    return () => {
      if (enterTimer) {
        clearTimeout(enterTimer);
      }
    };
  }, []);

  // Safely handle automatic dismissal
  const handleDismiss = useCallback(() => {
    safeDOMOperation(
      () => {
        setAnimationState('exiting');
        setTimeout(() => {
          onDismiss();
        }, animationConfig.exitDuration);
      },
      'dismissal animation',
      (error) => {
        challengeNotificationErrorHandler.handleError(error);
        // Fallback: dismiss immediately if animation fails
        onDismiss();
      }
    );
  }, [onDismiss, animationConfig.exitDuration]);

  useEffect(() => {
    const dismissTimer = setTimeout(handleDismiss, duration);
    return () => clearTimeout(dismissTimer);
  }, [duration, handleDismiss]);

  // Safely validate notification data
  const validateNotification = useCallback(() => {
    if (!notification) {
      setRenderingError('Missing notification data');
      return false;
    }
    
    if (!notification.playerName || !notification.challengeName) {
      setRenderingError('Incomplete notification data');
      return false;
    }
    
    return true;
  }, [notification]);

  // Validate notification on mount
  useEffect(() => {
    if (!validateNotification()) {
      const error = createRenderingError(
        'ChallengeNotificationPopup',
        'validate notification data',
        new Error('Invalid notification data'),
        { notification }
      );
      challengeNotificationErrorHandler.handleError(error);
    }
  }, [validateNotification]);

  // Render error fallback if there's a rendering error
  if (renderingError) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-yellow-100 border border-yellow-300 rounded-lg p-4 max-w-sm">
        <div className="flex items-center gap-2 text-yellow-800">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-medium">Notification Issue</p>
            <p className="text-sm">{renderingError}</p>
          </div>
        </div>
      </div>
    );
  }

  // Render minimal fallback if notification data is invalid
  if (!validateNotification()) {
    return (
      <div className="fixed top-4 right-4 z-50 bg-gray-100 border border-gray-300 rounded-lg p-4 max-w-sm">
        <div className="flex items-center gap-2 text-gray-800">
          <span className="text-lg">📢</span>
          <div>
            <p className="font-medium">Challenge Completed</p>
            <p className="text-sm">A player completed a challenge</p>
          </div>
        </div>
      </div>
    );
  }

  // Position classes based on position prop
  const getPositionClasses = () => {
    switch (position) {
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2';
      case 'center':
        return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
      case 'top-right':
      default:
        return 'top-4 right-4';
    }
  };

  // Hardware-accelerated animation classes for smooth performance
  const getAnimationClasses = () => {
    const baseClasses = 'will-change-transform transition-all';
    const timingFunction = animationState === 'entering' ? animationConfig.enterEasing : animationConfig.exitEasing;
    const duration = animationState === 'entering' ? animationConfig.enterDuration : animationConfig.exitDuration;
    
    const transitionStyle = `${duration}ms ${timingFunction}`;
    
    switch (animationState) {
      case 'entering':
        return `${baseClasses} opacity-0 scale-95 -translate-y-2`;
      case 'visible':
        return `${baseClasses} opacity-100 scale-100 translate-y-0`;
      case 'exiting':
        return `${baseClasses} opacity-0 scale-95 translate-y-2`;
      default:
        return `${baseClasses} opacity-0 scale-95 -translate-y-2`;
    }
  };

  // Get transition style for dynamic animation timing
  const getTransitionStyle = () => {
    const timingFunction = animationState === 'entering' ? animationConfig.enterEasing : animationConfig.exitEasing;
    const duration = animationState === 'entering' ? animationConfig.enterDuration : animationConfig.exitDuration;
    
    return {
      transitionDuration: `${duration}ms`,
      transitionTimingFunction: timingFunction,
      transitionProperty: 'all'
    };
  };

  return (
    <div
      data-testid="challenge-notification-popup"
      className={`
        fixed z-50 pointer-events-none
        ${getPositionClasses()}
        ${getAnimationClasses()}
        responsive-container
      `}
      style={{
        maxWidth: 'min(400px, calc(100vw - 2rem))',
        minWidth: '280px',
        // Hardware acceleration for better performance
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        perspective: '1000px',
        // Dynamic animation timing from configuration
        ...getTransitionStyle()
      }}
    >
      {/* Main notification card with enhanced animations */}
      <div className="
        bg-white/95 backdrop-blur-sm
        rounded-xl shadow-2xl border border-white/20
        p-6 relative overflow-hidden
        responsive-card
        transform-gpu
      ">
        {/* Celebratory background gradient with pulse animation */}
        <div 
          data-testid="notification-celebration"
          className="
            absolute inset-0 bg-gradient-to-br 
            from-yellow-400/20 via-orange-400/20 to-red-400/20
            animate-pulse
          "
          style={{
            animation: 'celebrationPulse 2s ease-in-out infinite'
          }}
        />
        
        {/* Enhanced celebration icon with bounce animation */}
        <div 
          className="absolute top-2 right-2 text-2xl"
          style={{
            animation: 'celebrationBounce 1s ease-in-out infinite'
          }}
        >
          🎉
        </div>

        {/* Content with fade-in animation */}
        <div 
          className="relative z-10"
          style={{
            animation: animationState === 'visible' ? 'contentFadeIn 0.4s ease-out 0.1s both' : undefined
          }}
        >
          {/* Header */}
          <div className="mb-3">
            <h3 className="
              text-lg font-bold text-gray-800 
              responsive-text text-scale-medium
              leading-tight
            ">
              Challenge Completed!
            </h3>
          </div>

          {/* Player information */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-2 h-2 bg-green-500 rounded-full"
                style={{
                  animation: 'statusPulse 1.5s ease-in-out infinite'
                }}
              />
              <span className="text-sm font-medium text-gray-600 responsive-text">
                Player
              </span>
            </div>
            <p 
              data-testid="notification-player-name"
              className="
                text-xl font-bold text-gray-900
                responsive-text text-scale-large
                truncate
              "
              title={notification.playerName}
            >
              {notification.playerName}
            </p>
          </div>

          {/* Challenge information */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full" />
              <span className="text-sm font-medium text-gray-600 responsive-text">
                Challenge
              </span>
            </div>
            <p 
              data-testid="notification-challenge-name"
              className="
                text-base font-semibold text-gray-800
                responsive-text text-scale-medium
                line-clamp-2
              "
              title={notification.challengeName}
            >
              {notification.challengeName}
            </p>
          </div>

          {/* Points display (if available) */}
          {notification.points !== undefined && notification.points !== null && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-600 responsive-text">
                Points Earned
              </span>
              <span 
                data-testid="notification-points"
                className="
                  text-lg font-bold text-green-600
                  responsive-text text-scale-medium
                "
                style={{
                  animation: animationState === 'visible' ? 'pointsHighlight 0.6s ease-out 0.3s both' : undefined
                }}
              >
                +{notification.points}
              </span>
            </div>
          )}

          {/* Completion time */}
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-xs text-gray-500 responsive-text">
              Completed {new Date(notification.completedAt).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Enhanced decorative elements with subtle animations */}
        <div 
          className="absolute -top-1 -right-1 w-8 h-8 bg-yellow-400/30 rounded-full blur-sm"
          style={{
            animation: 'decorativeFloat 3s ease-in-out infinite'
          }}
        />
        <div 
          className="absolute -bottom-2 -left-2 w-6 h-6 bg-orange-400/30 rounded-full blur-sm"
          style={{
            animation: 'decorativeFloat 3s ease-in-out infinite 1.5s'
          }}
        />
      </div>

      {/* Enhanced progress bar for dismissal timing */}
      <div className="mt-2 bg-white/20 rounded-full h-1 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all ease-linear"
          style={{
            width: '100%',
            animation: `progressShrink ${duration}ms linear forwards`
          }}
        />
      </div>

      {/* Enhanced CSS animations with hardware acceleration */}
      <style>{`
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        
        @keyframes celebrationPulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.02); }
        }
        
        @keyframes celebrationBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-4px) scale(1.1); }
          60% { transform: translateY(-2px) scale(1.05); }
        }
        
        @keyframes contentFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes pointsHighlight {
          0% { transform: scale(1); color: rgb(34 197 94); }
          50% { transform: scale(1.1); color: rgb(22 163 74); }
          100% { transform: scale(1); color: rgb(34 197 94); }
        }
        
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(0.9); }
        }
        
        @keyframes decorativeFloat {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-2px) rotate(1deg); }
          66% { transform: translateY(1px) rotate(-1deg); }
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        .transform-gpu {
          transform: translateZ(0);
        }
        
        .will-change-transform {
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
};

/**
 * Wrapped component with error boundary
 */
const ChallengeNotificationPopupWithErrorBoundary: React.FC<ChallengeNotificationPopupProps> = (props) => {
  return (
    <ChallengeNotificationErrorBoundary>
      <ChallengeNotificationPopup {...props} />
    </ChallengeNotificationErrorBoundary>
  );
};

export default ChallengeNotificationPopupWithErrorBoundary;