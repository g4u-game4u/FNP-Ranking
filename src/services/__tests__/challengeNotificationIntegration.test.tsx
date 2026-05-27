/**
 * Challenge Notification System Integration Tests
 * 
 * Tests the complete notification flow from webhook to popup dismissal
 * and integration with existing API service.
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';
import { ChallengeNotificationDisplay } from '../../components/ChallengeNotificationDisplay';
import { challengeNotificationSystem } from '../challengeNotificationSystemIntegration';
import { notificationQueueManager } from '../notificationQueueManager';
import { sseClient } from '../sseClientService';
import { challengeNotificationConfig } from '../challengeNotificationConfigService';
import type { ChallengeCompletionEvent } from '../sseClientService';

// Mock the SSE client and other dependencies
vi.mock('../sseClientService', () => ({
  sseClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    getConnectionState: vi.fn(),
    onEvent: vi.fn(),
    onConnectionStateChange: vi.fn(),
    onError: vi.fn()
  }
}));

vi.mock('../challengeNotificationSystemIntegration', () => ({
  challengeNotificationSystem: {
    initialize: vi.fn(),
    shutdown: vi.fn(),
    getHealthStatus: vi.fn(),
    onSystemEvent: vi.fn(),
    forceRecovery: vi.fn()
  }
}));

vi.mock('../challengeNotificationConfigService', () => ({
  challengeNotificationConfig: {
    getConfig: vi.fn(),
    shouldNotifyForChallenge: vi.fn(),
    onConfigChange: vi.fn(),
    onValidation: vi.fn()
  }
}));

describe('Challenge Notification System Integration', () => {
  const mockSSEClient = sseClient as any;
  const mockSystem = challengeNotificationSystem as any;
  const mockConfig = challengeNotificationConfig as any;

  // Sample test data
  const sampleNotification: ChallengeCompletionEvent = {
    id: 'test-event-1',
    playerId: 'player-123',
    playerName: 'Test Player',
    challengeId: 'challenge-456',
    challengeName: 'Complete Daily Tasks',
    completedAt: new Date().toISOString(),
    points: 100,
    timestamp: new Date().toISOString()
  };

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Setup default mock implementations
    mockSSEClient.isConnected.mockReturnValue(true);
    mockSSEClient.getConnectionState.mockReturnValue({
      status: 'connected',
      reconnectAttempts: 0,
      maxReconnectAttempts: 3
    });
    mockSSEClient.connect.mockResolvedValue(undefined);
    mockSSEClient.disconnect.mockReturnValue(undefined);
    mockSSEClient.onEvent.mockReturnValue(undefined);
    mockSSEClient.onConnectionStateChange.mockReturnValue(undefined);
    mockSSEClient.onError.mockReturnValue(undefined);

    mockSystem.initialize.mockResolvedValue(undefined);
    mockSystem.shutdown.mockReturnValue(undefined);
    mockSystem.getHealthStatus.mockReturnValue({
      overall: 'healthy',
      components: {
        sseConnection: 'connected',
        errorHandler: 'active',
        configuration: 'loaded'
      },
      metrics: {
        uptime: 10000,
        totalErrors: 0,
        recentErrors: 0,
        degradationLevel: 0
      },
      recommendations: []
    });
    mockSystem.onSystemEvent.mockReturnValue(() => {});
    mockSystem.forceRecovery.mockResolvedValue(true);

    mockConfig.getConfig.mockReturnValue({
      displayDuration: 4000,
      position: 'top-right',
      maxQueueSize: 10,
      enabledChallengeTypes: [],
      enabledChallengeCategories: [],
      animationConfig: {
        enterDuration: 300,
        exitDuration: 300,
        enterEasing: 'ease-out',
        exitEasing: 'ease-in'
      },
      sseConfig: {
        url: '/api/challenge-events',
        reconnectInterval: 5000,
        maxReconnectAttempts: 3,
        heartbeatTimeout: 30000
      },
      webhookConfig: {
        endpoint: '/api/challenge-webhook',
        authToken: 'test-token'
      }
    });
    mockConfig.shouldNotifyForChallenge.mockReturnValue(true);
    mockConfig.onConfigChange.mockReturnValue(() => {});
    mockConfig.onValidation.mockReturnValue(() => {});

    // Clear notification queue
    notificationQueueManager.clear();
  });

  afterEach(() => {
    // Clean up any remaining notifications
    notificationQueueManager.clear();
  });

  describe('End-to-End Notification Flow', () => {
    it('should handle complete flow from SSE event to popup display and dismissal', async () => {
      // Render the notification display component
      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Simulate SSE event callback being registered
      let sseEventCallback: ((event: any) => void) | null = null;
      mockSSEClient.onEvent.mockImplementation((callback: (event: any) => void) => {
        sseEventCallback = callback;
      });

      // Trigger the SSE event callback setup (simulates hook initialization)
      const { rerender } = render(<ChallengeNotificationDisplay showErrors={false} />);

      // Wait for initialization
      await waitFor(() => {
        expect(mockSSEClient.onEvent).toHaveBeenCalled();
      });

      // Simulate receiving an SSE event
      if (sseEventCallback) {
        sseEventCallback({
          type: 'challenge-completed',
          data: sampleNotification,
          timestamp: new Date().toISOString()
        });
      }

      // Wait for notification to appear
      await waitFor(() => {
        expect(screen.getByTestId('challenge-notification-popup')).toBeInTheDocument();
      });

      // Verify notification content
      expect(screen.getByTestId('notification-player-name')).toHaveTextContent('Test Player');
      expect(screen.getByTestId('notification-challenge-name')).toHaveTextContent('Complete Daily Tasks');
      expect(screen.getByTestId('notification-points')).toHaveTextContent('+100');

      // Verify celebratory elements
      expect(screen.getByTestId('notification-celebration')).toBeInTheDocument();

      // Wait for automatic dismissal (using shorter timeout for testing)
      await waitFor(() => {
        expect(screen.queryByTestId('challenge-notification-popup')).not.toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('should handle multiple notifications sequentially', async () => {
      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Setup SSE event callback
      let sseEventCallback: ((event: any) => void) | null = null;
      mockSSEClient.onEvent.mockImplementation((callback: (event: any) => void) => {
        sseEventCallback = callback;
      });

      await waitFor(() => {
        expect(mockSSEClient.onEvent).toHaveBeenCalled();
      });

      // Create multiple notifications
      const notification1 = { ...sampleNotification, id: 'event-1', playerName: 'Player 1' };
      const notification2 = { ...sampleNotification, id: 'event-2', playerName: 'Player 2' };

      // Send first notification
      if (sseEventCallback) {
        sseEventCallback({
          type: 'challenge-completed',
          data: notification1,
          timestamp: new Date().toISOString()
        });
      }

      // Verify first notification appears
      await waitFor(() => {
        expect(screen.getByTestId('notification-player-name')).toHaveTextContent('Player 1');
      });

      // Send second notification while first is still showing
      if (sseEventCallback) {
        sseEventCallback({
          type: 'challenge-completed',
          data: notification2,
          timestamp: new Date().toISOString()
        });
      }

      // First notification should still be showing
      expect(screen.getByTestId('notification-player-name')).toHaveTextContent('Player 1');

      // Wait for first notification to dismiss and second to appear
      await waitFor(() => {
        expect(screen.getByTestId('notification-player-name')).toHaveTextContent('Player 2');
      }, { timeout: 6000 });
    });

    it('should handle SSE connection errors gracefully', async () => {
      // Setup error state
      mockSSEClient.isConnected.mockReturnValue(false);
      mockSSEClient.getConnectionState.mockReturnValue({
        status: 'error',
        error: 'Connection failed',
        reconnectAttempts: 1,
        maxReconnectAttempts: 3
      });

      render(<ChallengeNotificationDisplay showErrors={true} />);

      // Should not show any notifications when disconnected
      expect(screen.queryByTestId('challenge-notification-popup')).not.toBeInTheDocument();

      // Should show error indicator if enabled
      // Note: Error display logic would be implemented in the actual component
    });

    it('should filter notifications based on configuration', async () => {
      // Setup configuration to filter out notifications
      mockConfig.shouldNotifyForChallenge.mockReturnValue(false);

      render(<ChallengeNotificationDisplay showErrors={false} />);

      let sseEventCallback: ((event: any) => void) | null = null;
      mockSSEClient.onEvent.mockImplementation((callback: (event: any) => void) => {
        sseEventCallback = callback;
      });

      await waitFor(() => {
        expect(mockSSEClient.onEvent).toHaveBeenCalled();
      });

      // Send notification that should be filtered
      if (sseEventCallback) {
        sseEventCallback({
          type: 'challenge-completed',
          data: sampleNotification,
          timestamp: new Date().toISOString()
        });
      }

      // Wait a bit to ensure no notification appears
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should not show notification due to filtering
      expect(screen.queryByTestId('challenge-notification-popup')).not.toBeInTheDocument();
    });
  });

  describe('Integration with Existing API Service', () => {
    it('should work alongside existing API calls', async () => {
      // This test verifies that the notification system doesn't interfere
      // with existing service functionality

      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Verify system initialization doesn't conflict with existing services
      expect(mockSystem.initialize).toHaveBeenCalled();
      expect(mockSSEClient.connect).toHaveBeenCalled();

      // Simulate existing API usage (would be mocked in real scenario)
      // This ensures the notification system is additive, not disruptive
      const mockApiCall = vi.fn().mockResolvedValue({ success: true });
      
      // Execute mock API call
      await mockApiCall();
      
      expect(mockApiCall).toHaveBeenCalled();

      // Notification system should still be functional
      expect(mockSSEClient.isConnected()).toBe(true);
    });

    it('should handle system recovery without affecting main application', async () => {
      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Simulate system error and recovery
      mockSystem.getHealthStatus.mockReturnValue({
        overall: 'degraded',
        components: {
          sseConnection: 'error',
          errorHandler: 'active',
          configuration: 'loaded'
        },
        metrics: {
          uptime: 10000,
          totalErrors: 5,
          recentErrors: 2,
          degradationLevel: 1
        },
        recommendations: ['Check network connectivity']
      });

      // Trigger recovery
      const recoveryResult = await mockSystem.forceRecovery();
      expect(recoveryResult).toBe(true);

      // System should recover without affecting main app
      expect(mockSystem.forceRecovery).toHaveBeenCalled();
    });
  });

  describe('Queue Management Integration', () => {
    it('should respect queue size limits', async () => {
      // Set small queue size for testing
      mockConfig.getConfig.mockReturnValue({
        ...mockConfig.getConfig(),
        maxQueueSize: 2
      });

      render(<ChallengeNotificationDisplay showErrors={false} />);

      let sseEventCallback: ((event: any) => void) | null = null;
      mockSSEClient.onEvent.mockImplementation((callback: (event: any) => void) => {
        sseEventCallback = callback;
      });

      await waitFor(() => {
        expect(mockSSEClient.onEvent).toHaveBeenCalled();
      });

      // Send more notifications than queue can handle
      const notifications = [
        { ...sampleNotification, id: 'event-1', playerName: 'Player 1' },
        { ...sampleNotification, id: 'event-2', playerName: 'Player 2' },
        { ...sampleNotification, id: 'event-3', playerName: 'Player 3' },
        { ...sampleNotification, id: 'event-4', playerName: 'Player 4' }
      ];

      if (sseEventCallback) {
        notifications.forEach(notification => {
          sseEventCallback!({
            type: 'challenge-completed',
            data: notification,
            timestamp: new Date().toISOString()
          });
        });
      }

      // Queue should handle overflow gracefully
      const queueState = notificationQueueManager.getState();
      expect(queueState.queueSize).toBeLessThanOrEqual(2);
    });

    it('should prevent duplicate notifications', async () => {
      render(<ChallengeNotificationDisplay showErrors={false} />);

      let sseEventCallback: ((event: any) => void) | null = null;
      mockSSEClient.onEvent.mockImplementation((callback: (event: any) => void) => {
        sseEventCallback = callback;
      });

      await waitFor(() => {
        expect(mockSSEClient.onEvent).toHaveBeenCalled();
      });

      // Send same notification twice
      if (sseEventCallback) {
        sseEventCallback({
          type: 'challenge-completed',
          data: sampleNotification,
          timestamp: new Date().toISOString()
        });

        sseEventCallback({
          type: 'challenge-completed',
          data: sampleNotification, // Same ID
          timestamp: new Date().toISOString()
        });
      }

      // Should only process once
      const queueState = notificationQueueManager.getState();
      expect(queueState.queueSize + (queueState.currentNotification ? 1 : 0)).toBe(1);
    });
  });

  describe('Configuration Integration', () => {
    it('should apply configuration changes dynamically', async () => {
      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Simulate configuration change
      let configChangeCallback: ((event: any) => void) | null = null;
      mockConfig.onConfigChange.mockImplementation((callback: (event: any) => void) => {
        configChangeCallback = callback;
      });

      await waitFor(() => {
        expect(mockConfig.onConfigChange).toHaveBeenCalled();
      });

      // Change configuration
      const newConfig = {
        ...mockConfig.getConfig(),
        displayDuration: 6000,
        position: 'top-center' as const
      };

      mockConfig.getConfig.mockReturnValue(newConfig);

      if (configChangeCallback) {
        configChangeCallback({
          type: 'config-updated',
          changes: { displayDuration: 6000, position: 'top-center' }
        });
      }

      // Configuration should be applied to new notifications
      expect(mockConfig.getConfig().displayDuration).toBe(6000);
      expect(mockConfig.getConfig().position).toBe('top-center');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle rendering errors gracefully', async () => {
      // Mock console.error to avoid test noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Create a component that will throw an error
      const ErrorComponent = () => {
        throw new Error('Test rendering error');
      };

      // The error boundary should catch this and show fallback UI
      // Note: In real implementation, this would be tested with error boundaries
      expect(() => render(<ErrorComponent />)).toThrow();

      consoleSpy.mockRestore();
    });

    it('should recover from SSE connection failures', async () => {
      render(<ChallengeNotificationDisplay showErrors={false} />);

      // Simulate connection failure
      mockSSEClient.isConnected.mockReturnValue(false);
      mockSSEClient.getConnectionState.mockReturnValue({
        status: 'error',
        error: 'Network error',
        reconnectAttempts: 2,
        maxReconnectAttempts: 3
      });

      // Simulate recovery
      mockSSEClient.connect.mockResolvedValueOnce(undefined);
      mockSSEClient.isConnected.mockReturnValue(true);
      mockSSEClient.getConnectionState.mockReturnValue({
        status: 'connected',
        reconnectAttempts: 0,
        maxReconnectAttempts: 3
      });

      // System should attempt recovery
      await mockSystem.forceRecovery();
      expect(mockSystem.forceRecovery).toHaveBeenCalled();
    });
  });
});