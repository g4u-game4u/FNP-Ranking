import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';
import { 
  ChallengeCompletionEvent, 
  parseWebhookPayload, 
  validateWebhookSignature 
} from './utils/webhook-utils.js';

// Create Redis client
const getRedisClient = async () => {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
};

// Error handling utilities for webhook processing
interface WebhookError {
  type: 'validation' | 'authentication' | 'processing' | 'system';
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

function createWebhookError(
  type: WebhookError['type'],
  code: string,
  message: string,
  context?: any,
  severity: WebhookError['severity'] = 'medium'
): WebhookError {
  return {
    type,
    code,
    message,
    timestamp: new Date(),
    context,
    severity
  };
}

function logWebhookError(error: WebhookError): void {
  const logMessage = `[WEBHOOK:${error.code}] ${error.message}`;
  const logContext = {
    timestamp: error.timestamp,
    context: error.context
  };
  
  switch (error.severity) {
    case 'critical':
    case 'high':
      console.error(logMessage, logContext);
      break;
    case 'medium':
      console.warn(logMessage, logContext);
      break;
    case 'low':
      console.info(logMessage, logContext);
      break;
  }
}

function handleWebhookError(error: WebhookError, res: VercelResponse): void {
  logWebhookError(error);
  
  // Determine HTTP status code based on error type and severity
  let statusCode = 500;
  let publicMessage = 'Internal server error';
  
  switch (error.type) {
    case 'validation':
      statusCode = 400;
      publicMessage = 'Invalid request data';
      break;
    case 'authentication':
      statusCode = 401;
      publicMessage = 'Authentication failed';
      break;
    case 'processing':
      statusCode = error.severity === 'critical' ? 500 : 422;
      publicMessage = error.severity === 'critical' ? 'Processing failed' : 'Unable to process request';
      break;
    case 'system':
      statusCode = 500;
      publicMessage = 'System error';
      break;
  }
  
  res.status(statusCode).json({
    error: publicMessage,
    code: error.code,
    timestamp: error.timestamp.toISOString()
  });
}



/**
 * Enhanced in-memory event storage with performance optimizations
 */
class OptimizedEventStore {
  private events: Map<string, ChallengeCompletionEvent> = new Map();
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes
  private readonly maxEvents = 100;
  private lastCleanup: number = Date.now();
  private readonly cleanupInterval: number = 30000; // 30 seconds
  private readonly batchSize: number = 50; // Process events in batches
  private eventCount: number = 0;

  addEvent(event: ChallengeCompletionEvent): void {
    // Add event with deduplication and performance tracking
    this.events.set(event.id, event);
    this.eventCount++;
    
    // Trigger cleanup if needed (throttled for performance)
    this.conditionalCleanup();
  }

  getRecentEvents(since?: Date): ChallengeCompletionEvent[] {
    const cutoff = since || new Date(Date.now() - this.maxAge);
    const cutoffTime = cutoff.getTime();
    
    const recentEvents: ChallengeCompletionEvent[] = [];
    
    // Efficient iteration with early termination
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp.getTime() >= cutoffTime) {
        recentEvents.push(event);
      }
    }
    
    // Sort by timestamp (most recent first) - only if needed
    if (recentEvents.length > 1) {
      recentEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    
    return recentEvents;
  }

  /**
   * Conditional cleanup - only run if enough time has passed
   */
  private conditionalCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
      this.lastCleanup = now;
    }
  }

  /**
   * Optimized cleanup with batching for large datasets
   */
  cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.maxAge;
    
    // Batch cleanup for better performance
    const entriesToDelete: string[] = [];
    let processedCount = 0;
    
    for (const [id, event] of this.events.entries()) {
      if (event.timestamp.getTime() < cutoff) {
        entriesToDelete.push(id);
      }
      
      // Process in batches to avoid blocking
      processedCount++;
      if (processedCount >= this.batchSize) {
        break;
      }
    }
    
    // Remove old events
    entriesToDelete.forEach(id => this.events.delete(id));
    
    // Limit total events if still over limit
    if (this.events.size > this.maxEvents) {
      this.limitEventCount();
    }
  }

  /**
   * Efficiently limit event count by keeping most recent
   */
  private limitEventCount(): void {
    if (this.events.size <= this.maxEvents) {
      return;
    }
    
    // Convert to array and sort by timestamp
    const sortedEvents = Array.from(this.events.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Clear and rebuild with only the most recent events
    this.events.clear();
    for (let i = 0; i < this.maxEvents && i < sortedEvents.length; i++) {
      const [id, event] = sortedEvents[i];
      this.events.set(id, event);
    }
  }

  size(): number {
    return this.events.size;
  }

  /**
   * Get performance statistics
   */
  getStats(): { 
    eventCount: number; 
    totalProcessed: number; 
    lastCleanup: Date; 
    estimatedMemoryKB: number;
  } {
    // Rough estimation of memory usage
    const avgEventSize = 500; // bytes per event (rough estimate)
    const estimatedMemoryKB = (this.events.size * avgEventSize) / 1024;
    
    return {
      eventCount: this.events.size,
      totalProcessed: this.eventCount,
      lastCleanup: new Date(this.lastCleanup),
      estimatedMemoryKB: Math.round(estimatedMemoryKB * 100) / 100
    };
  }

  /**
   * Force cleanup for high-frequency scenarios
   */
  forceCleanup(): void {
    this.cleanup();
    this.lastCleanup = Date.now();
  }
}

// Global optimized event store instance
const eventStore = new OptimizedEventStore();

/**
 * High-frequency webhook processor with batching and throttling
 */
class HighFrequencyWebhookProcessor {
  private processingQueue: Array<{ event: ChallengeCompletionEvent; timestamp: number }> = [];
  private isProcessing: boolean = false;
  private readonly batchSize: number = 10;
  private readonly processingDelay: number = 50; // 50ms delay for batching
  private processingTimeoutId: NodeJS.Timeout | null = null;
  private processedCount: number = 0;

  addEvent(event: ChallengeCompletionEvent): void {
    this.processingQueue.push({ event, timestamp: Date.now() });
    
    // Schedule processing if not already scheduled
    if (!this.isProcessing && this.processingTimeoutId === null) {
      this.scheduleProcessing();
    }
  }

  private scheduleProcessing(): void {
    this.processingTimeoutId = setTimeout(() => {
      this.processBatch();
    }, this.processingDelay);
  }

  private processBatch(): void {
    if (this.processingQueue.length === 0) {
      this.processingTimeoutId = null;
      return;
    }

    this.isProcessing = true;
    
    // Process events in batches
    const batch = this.processingQueue.splice(0, this.batchSize);
    
    batch.forEach(({ event }) => {
      try {
        // Store event
        eventStore.addEvent(event);
        
        // Broadcast to SSE clients
        broadcastEventToSSEClients(event);
        
        this.processedCount++;
      } catch (error) {
        const webhookError = createWebhookError(
          'processing',
          'BATCH_PROCESSING_ERROR',
          'Error processing event in batch',
          { error, eventId: event.id },
          'medium'
        );
        logWebhookError(webhookError);
      }
    });

    this.isProcessing = false;
    this.processingTimeoutId = null;

    // Schedule next batch if there are more events
    if (this.processingQueue.length > 0) {
      this.scheduleProcessing();
    }
  }

  getStats(): { queueLength: number; processedCount: number; isProcessing: boolean } {
    return {
      queueLength: this.processingQueue.length,
      processedCount: this.processedCount,
      isProcessing: this.isProcessing
    };
  }
}

// Global high-frequency processor
const highFrequencyProcessor = new HighFrequencyWebhookProcessor();



/**
 * Serverless function to handle Funifier webhook data with comprehensive error handling
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers for webhook endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-funifier-signature');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    const error = createWebhookError(
      'validation',
      'METHOD_NOT_ALLOWED',
      `Method ${req.method} not allowed`,
      { method: req.method },
      'medium'
    );
    return handleWebhookError(error, res);
  }

  try {
    // Validate request body exists
    if (!req.body) {
      const error = createWebhookError(
        'validation',
        'MISSING_BODY',
        'Request body is required',
        { headers: req.headers },
        'high'
      );
      return handleWebhookError(error, res);
    }

    // Get raw body for signature validation
    let rawBody: string;
    try {
      rawBody = JSON.stringify(req.body);
    } catch (jsonError) {
      const error = createWebhookError(
        'validation',
        'INVALID_JSON',
        'Request body must be valid JSON',
        { body: req.body, jsonError },
        'high'
      );
      return handleWebhookError(error, res);
    }

    const signature = req.headers['x-funifier-signature'] as string;

    // Validate webhook signature
    try {
      if (!validateWebhookSignature(rawBody, signature)) {
        const error = createWebhookError(
          'authentication',
          'INVALID_SIGNATURE',
          'Webhook signature validation failed',
          { 
            hasSignature: !!signature,
            bodyLength: rawBody.length,
            userAgent: req.headers['user-agent']
          },
          'high'
        );
        return handleWebhookError(error, res);
      }
    } catch (signatureError) {
      const error = createWebhookError(
        'authentication',
        'SIGNATURE_VALIDATION_ERROR',
        'Error validating webhook signature',
        { signatureError, signature },
        'critical'
      );
      return handleWebhookError(error, res);
    }

    // Parse and validate payload
    let event: ChallengeCompletionEvent | null;
    try {
      event = parseWebhookPayload(req.body);
      if (!event) {
        const error = createWebhookError(
          'validation',
          'INVALID_PAYLOAD',
          'Webhook payload validation failed',
          { payload: req.body },
          'high'
        );
        return handleWebhookError(error, res);
      }
    } catch (parseError) {
      const error = createWebhookError(
        'processing',
        'PAYLOAD_PARSE_ERROR',
        'Failed to parse webhook payload',
        { parseError, payload: req.body },
        'high'
      );
      return handleWebhookError(error, res);
    }

    // Store event in Redis for real-time SSE delivery
    let redis;
    try {
      redis = await getRedisClient();
      
      // Store the event with a TTL of 5 minutes
      const eventKey = `challenge-event:${event.id}`;
      const eventData = JSON.stringify({
        ...event,
        completedAt: event.completedAt.toISOString(),
        timestamp: event.timestamp.toISOString()
      });
      
      await redis.setEx(eventKey, 300, eventData); // 5 minute expiry
      
      // Also add to a list of recent events for SSE polling
      await redis.lPush('challenge-events:recent', eventData);
      
      // Trim the list to keep only last 50 events
      await redis.lTrim('challenge-events:recent', 0, 49);
      
      // Store the latest event timestamp for quick polling
      await redis.set('challenge-events:latest', Date.now().toString());
      
      console.log('Event stored in Redis:', event.id);
    } catch (redisError) {
      console.error('Failed to store event in Redis:', redisError);
      // Continue processing even if Redis fails
    } finally {
      if (redis) {
        await redis.disconnect();
      }
    }

    // Also use local processor for backward compatibility
    try {
      highFrequencyProcessor.addEvent(event);
    } catch (processingError) {
      const error = createWebhookError(
        'system',
        'HIGH_FREQUENCY_PROCESSING_ERROR',
        'Failed to add event to high-frequency processor',
        { processingError, event },
        'critical'
      );
      logWebhookError(error);
    }

    // Log successful processing with performance metrics
    const processingEndTime = Date.now();
    const eventStoreStats = eventStore.getStats();
    const processorStats = highFrequencyProcessor.getStats();
    
    console.log('Challenge completion event processed successfully:', {
      id: event.id,
      playerId: event.playerId,
      playerName: event.playerName,
      challengeId: event.challengeId,
      challengeName: event.challengeName,
      completedAt: event.completedAt,
      processingTime: processingEndTime,
      performance: {
        eventStoreSize: eventStoreStats.eventCount,
        totalProcessed: eventStoreStats.totalProcessed,
        estimatedMemoryKB: eventStoreStats.estimatedMemoryKB,
        processorQueueLength: processorStats.queueLength,
        processorProcessedCount: processorStats.processedCount
      }
    });

    // Return success response with performance info
    return res.status(200).json({ 
      success: true,
      eventId: event.id,
      message: 'Event processed successfully',
      timestamp: new Date().toISOString(),
      performance: {
        eventStoreSize: eventStoreStats.eventCount,
        processingQueueLength: processorStats.queueLength,
        estimatedMemoryKB: eventStoreStats.estimatedMemoryKB
      }
    });

  } catch (error: any) {
    // Handle unexpected errors
    const webhookError = createWebhookError(
      'system',
      'UNEXPECTED_ERROR',
      error.message || 'Unexpected error occurred',
      { 
        error,
        stack: error.stack,
        requestId: req.headers['x-request-id'] || 'unknown'
      },
      'critical'
    );
    return handleWebhookError(webhookError, res);
  }
}

/**
 * Broadcast event to SSE clients
 * In a real implementation, this would be shared between endpoints
 * For now, we'll implement a simple notification mechanism
 */
function broadcastEventToSSEClients(event: ChallengeCompletionEvent): void {
  // In production, this would integrate with the SSE connection manager
  // For now, we'll just log that an event should be broadcast
  console.log('Broadcasting event to SSE clients:', event.id);
  
  // TODO: Integrate with actual SSE connection manager
  // This would require shared state management between serverless functions
}

// Export event store for SSE endpoint
export { eventStore };