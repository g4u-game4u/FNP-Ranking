import crypto from 'crypto';

/**
 * Challenge completion event data structure
 */
export interface ChallengeCompletionEvent {
  id: string;
  playerId: string;
  playerName: string;
  challengeId: string;
  challengeName: string;
  completedAt: Date;
  points?: number;
  timestamp: Date;
}

/**
 * Webhook payload structure
 */
export interface WebhookPayload {
  eventType: 'challenge_completed';
  data: {
    playerId: string;
    playerName?: string;
    challengeId: string;
    challengeName?: string;
    completedAt: string;
    points?: number;
  };
  timestamp: string;
  signature?: string;
}

/**
 * Parse and validate webhook payload
 */
export function parseWebhookPayload(body: any): ChallengeCompletionEvent | null {
  try {
    if (!body || typeof body !== 'object') {
      return null;
    }

    const payload = body as WebhookPayload;
    
    if (payload.eventType !== 'challenge_completed') {
      return null;
    }

    if (!payload.data || !payload.data.playerId || !payload.data.challengeId) {
      return null;
    }

    // Generate unique event ID for deduplication
    const eventId = `${payload.data.playerId}-${payload.data.challengeId}-${payload.timestamp}`;
    
    const event: ChallengeCompletionEvent = {
      id: eventId,
      playerId: payload.data.playerId,
      playerName: payload.data.playerName || `Player ${payload.data.playerId}`,
      challengeId: payload.data.challengeId,
      challengeName: payload.data.challengeName || `Challenge ${payload.data.challengeId}`,
      completedAt: new Date(payload.data.completedAt || payload.timestamp),
      points: payload.data.points,
      timestamp: new Date(payload.timestamp)
    };

    return event;
  } catch (error) {
    console.error('Error parsing webhook payload:', error);
    return null;
  }
}

/**
 * Validate webhook signature for security
 */
export function validateWebhookSignature(payload: string, signature?: string): boolean {
  if (!signature) {
    // For now, allow unsigned webhooks in development
    // In production, this should be required
    return true;
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('WEBHOOK_SECRET not configured, skipping signature validation');
    return true;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    
    const providedSignature = signature.replace('sha256=', '');
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    );
  } catch (error) {
    console.error('Error validating webhook signature:', error);
    return false;
  }
}