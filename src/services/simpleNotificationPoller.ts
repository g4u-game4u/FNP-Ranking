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
  priva