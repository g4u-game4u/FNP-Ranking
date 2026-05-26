/**
 * Simple Notification Poller
 * Polls the webhook endpoint for recent events instead of using SSE
 */

export interface ChallengeEvent {
  id: string;
  playerId: string;
  playerName: string;
  challengeId: string;
  challengeName: string;
  completedAt: string;
  points?: number;
  timestamp: string;
}

type EventCallback = (event: ChallengeEvent) => void;

class SimpleNotificationPoller {
  private pollingInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private callbacks: Set<EventCallback> = new Set();
  private lastEventId: string | null = null;
  private isPolling = false;

  constructor(pollingInterval = 5000) {
    this.pollingInterval = pollingInterval;
  }

  start() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.poll(); // Initial poll
    this.intervalId = setInterval(() => this.poll(), this.pollingInterval);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
  }

  subscribe(callback: EventCallback) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private async poll() {
    try {
      // In a real implementation, this would call your webhook endpoint
      // For now, this is a placeholder
      const response = await fetch('/api/challenge-events-poll', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Failed to poll events:', response.statusText);
        return;
      }

      const events: ChallengeEvent[] = await response.json();
      
      // Filter out events we've already seen
      const newEvents = this.lastEventId
        ? events.filter(e => e.id > this.lastEventId!)
        : events;

      // Update last event ID
      if (newEvents.length > 0) {
        this.lastEventId = newEvents[newEvents.length - 1].id;
      }

      // Notify subscribers
      newEvents.forEach(event => {
        this.callbacks.forEach(callback => callback(event));
      });
    } catch (error) {
      console.error('Error polling events:', error);
    }
  }
}

export const simpleNotificationPoller = new SimpleNotificationPoller();
