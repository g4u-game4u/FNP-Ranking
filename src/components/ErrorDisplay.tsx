import React, { useCallback } from 'react';
import type { ApiError } from '../types';

interface ErrorDisplayProps {
  /** The error to display */
  error: ApiError | null;
  /** Callback to retry the failed operation */
  onRetry?: () => void;
  /** Callback to dismiss the error */
  onDismiss?: () => void;
  /** Whether to show the retry button (default: true) */
  showRetry?: boolean;
  /** Whether to show the dismiss button (default: true) */
  showDismiss?: boolean;
  /** Custom CSS classes */
  className?: string;
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Position variant */
  position?: 'inline' | 'floating' | 'banner';
}

/**
 * Get user-friendly error message based on error type
 */
const getErrorMessage = (error: ApiError): string => {
  switch (error.type) {
    case 'network':
      if (error.message.includes('Rate limit')) {
        return 'Too many requests. Please wait a moment before trying again.';
      }
      if (error.message.includes('timeout')) {
        return 'Connection timed out. Please check your internet connection and try again.';
      }
      return 'Unable to connect to the server. Please check your internet connection.';
    
    case 'auth':
      return 'Authentication failed. Please check your API credentials in the configuration.';
    
    case 'validation':
      if (error.message.includes('not found')) {
        return 'The requested leaderboard could not be found. It may have been deleted or moved.';
      }
      return 'Invalid data received from the server. Please try refreshing the page.';
    
    case 'config':
      return 'Configuration error. Please check your API settings.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Get error icon based on error type
 */
const getErrorIcon = (error: ApiError): string => {
  switch (error.type) {
    case 'network':
      return '🌐';
    case 'auth':
      return '🔒';
    case 'validation':
      return '⚠️';
    case 'config':
      return '⚙️';
    default:
      return '❌';
  }
};

/**
 * Format timestamp for display
 */
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) {
    return 'just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleTimeString();
  }
};

/**
 * Error display component with user-friendly messages and retry functionality
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  showRetry = true,
  showDismiss = true,
  className = '',
  size = 'medium',
  position = 'inline',
}) => {
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry();
    }
  }, [onRetry]);

  const handleDismiss = useCallback(() => {
    if (onDismiss) {
      onDismiss();
    }
  }, [onDismiss]);

  if (!error) {
    return null;
  }

  // Size classes
  const sizeClasses = {
    small: 'text-sm p-3',
    medium: 'text-base p-4',
    large: 'text-lg p-6',
  };

  // Position classes
  const positionClasses = {
    inline: 'relative',
    floating: 'fixed top-4 right-4 z-50 max-w-md',
    banner: 'w-full',
  };

  // Error type classes
  const typeClasses = {
    network: 'bg-blue-50 border-blue-200 text-blue-800',
    auth: 'bg-red-50 border-red-200 text-red-800',
    validation: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    config: 'bg-purple-50 border-purple-200 text-purple-800',
  };

  const errorMessage = getErrorMessage(error);
  const errorIcon = getErrorIcon(error);
  const timestamp = formatTimestamp(error.timestamp);

  return (
    <div
      className={`
        border rounded-lg shadow-sm
        ${sizeClasses[size]}
        ${positionClasses[position]}
        ${typeClasses[error.type]}
        ${className}
      `}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start space-x-3">
        {/* Error Icon */}
        <div className="flex-shrink-0 text-xl">
          {errorIcon}
        </div>

        {/* Error Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-medium mb-1">
                {error.type === 'network' && 'Connection Error'}
                {error.type === 'auth' && 'Authentication Error'}
                {error.type === 'validation' && 'Data Error'}
                {error.type === 'config' && 'Configuration Error'}
              </h3>
              
              <p className="text-sm opacity-90 mb-2">
                {errorMessage}
              </p>

              <p className="text-xs opacity-75">
                Occurred {timestamp}
              </p>
            </div>

            {/* Dismiss Button */}
            {showDismiss && onDismiss && (
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 ml-2 text-lg opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss error"
              >
                ×
              </button>
            )}
          </div>

          {/* Action Buttons */}
          {(showRetry && onRetry && error.retryable) && (
            <div className="mt-3 flex space-x-2">
              <button
                type="button"
                onClick={handleRetry}
                className="
                  px-3 py-1 text-sm font-medium rounded
                  bg-white bg-opacity-80 hover:bg-opacity-100
                  border border-current border-opacity-30
                  transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-current focus:ring-opacity-50
                "
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Compact error display for use in smaller spaces
 */
export const CompactErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'size' | 'position'>> = (props) => {
  return <ErrorDisplay {...props} size="small" position="inline" />;
};

/**
 * Floating error notification for global errors
 */
export const FloatingErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'position'>> = (props) => {
  return <ErrorDisplay {...props} position="floating" />;
};

/**
 * Banner error display for critical errors
 */
export const BannerErrorDisplay: React.FC<Omit<ErrorDisplayProps, 'position'>> = (props) => {
  return <ErrorDisplay {...props} position="banner" />;
};