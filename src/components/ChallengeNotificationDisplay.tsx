/**
 * Challenge Notification Display Component
 * 
 * Integrates with the main application to display challenge completion notifications.
 * Handles the complete notification lifecycle from polling events to popup dismissal.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { ChallengeNotificationPopup } from './ChallengeNotificationPopup';
import { challengeEventPoller, type ChallengeEvent } from '../services/challengeEventPoller';
import { useDisplayConfig } from '../hooks/useChallengeNotificationConfig';

export interface ChallengeNotificationDisplayProps {
  showConnectionStatus?: boolean;
  position?: 'top-right' | 'top-center' | 'center';
  duration?: number;
  showErrors?: boolean;
  className?: string;
}

export const ChallengeNotificationDisplay: React.FC<ChallengeNotificationDisplayProps> = ({
  showConnectionStatus = false,
  position: propPosition,
  duration: propDuration,
  showErrors = true,
  className
}) => {
  const [currentNotification, setCurrentNotification] = useState<ChallengeEvent | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<ChallengeEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [hasErrors, setHasErrors] = useState(false);

  const displayConfig = useDisplayConfig();
  const position = propPosition || displayConfig.position;
  const duration = propDuration || displayConfig.displayDuration;

  // Start polling on mount
  useEffect(() => {
    // TODO: Re-enable challenge event polling after migrating from Redis to Supabase
    // Redis is not configured in production, causing 500 errors
    console.log('Challenge event polling disabled - awaiting Supabase migration');
    setIsPolling(false);
    
    // Uncomment when Supabase-based polling is implemented:
    // console.log('Starting challenge event poller...');
    // challengeEventPoller.start(2000);
    // setIsPolling(true);
    //
    // const unsubscribe = challengeEventPoller.onEvent((event) => {
    //   console.log('Received challenge event:', event);
    //   setNotificationQueue(prev => [...prev, event]);
    // });
    //
    // return () => {
    //   unsubscribe();
    //   challengeEventPoller.stop();
    //   setIsPolling(false);
    // };
  }, []);

  // Process notification queue
  useEffect(() => {
    if (!currentNotification && notificationQueue.length > 0) {
      const [next, ...rest] = notificationQueue;
      setCurrentNotification(next);
      setNotificationQueue(rest);
    }
  }, [currentNotification, notificationQueue]);

  const dismissNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const clearErrors = useCallback(() => {
    setHasErrors(false);
  }, []);

  // Convert ChallengeEvent to the format expected by ChallengeNotificationPopup
  const notificationForPopup = currentNotification ? {
    id: currentNotification.id,
    playerId: currentNotification.playerId,
    playerName: currentNotification.playerName,
    challengeId: currentNotification.challengeId,
    challengeName: currentNotification.challengeName,
    completedAt: currentNotification.completedAt,
    points: currentNotification.points,
    timestamp: currentNotification.timestamp
  } : null;

  return (
    <div className={`challenge-notification-display ${className || ''}`}>
      {notificationForPopup && (
        <ChallengeNotificationPopup
          notification={notificationForPopup}
          position={position}
          duration={duration}
          onDismiss={dismissNotification}
        />
      )}

      {showConnectionStatus && (
        <div className={`
          fixed bottom-4 left-4 z-40
          px-3 py-2 rounded-lg text-sm font-medium
          transition-all duration-300
          ${isPolling 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
          }
        `}>
          <div className="flex items-center gap-2">
            <div className={`
              w-2 h-2 rounded-full
              ${isPolling ? 'bg-green-500' : 'bg-red-500'}
            `} />
            <span>
              {isPolling ? 'Notifications Active' : 'Notifications Offline'}
            </span>
          </div>
        </div>
      )}

      {showErrors && hasErrors && (
        <div className="
          fixed bottom-4 right-4 z-40
          bg-yellow-100 border border-yellow-200 rounded-lg
          px-4 py-3 max-w-sm
        ">
          <div className="flex items-start gap-3">
            <span className="text-yellow-600 text-lg flex-shrink-0">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-yellow-800">
                Notification System Issue
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Some notifications may not be displayed
              </p>
            </div>
            <button
              onClick={clearErrors}
              className="text-yellow-600 hover:text-yellow-800 text-xs font-medium flex-shrink-0"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const KioskNotificationDisplay: React.FC<{
  position?: 'top-right' | 'top-center' | 'center';
  duration?: number;
}> = ({ position = 'top-center', duration = 5000 }) => {
  return (
    <ChallengeNotificationDisplay
      position={position}
      duration={duration}
      showConnectionStatus={false}
      showErrors={false}
      className="kiosk-notifications"
    />
  );
};

export const AdminNotificationDisplay: React.FC = () => {
  return (
    <ChallengeNotificationDisplay
      showConnectionStatus={true}
      showErrors={true}
      className="admin-notifications"
    />
  );
};

export default ChallengeNotificationDisplay;