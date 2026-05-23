import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from 'redis';

// Create Redis client
const getRedisClient = async () => {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  return client;
};

/**
 * Challenge completion event data structure
 */
interface ChallengeCompletionEvent {
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
 * SSE connection management
 */
interface SSEConnection {
  id: string;
  response: VercelResponse;
  lastEventId?: string;
  connectedAt: Date;
}

/**
 * Simple event store interface for SSE
 */
interface EventStore {
  getRecentEvents(since?: Date): ChallengeCompletionEvent[];
  size(): number;
}

// Error handling utilities for SSE endpoint
interface SSEError {
  type: 'connection' | 'broadcast' | 'system' | 'validation';
  code: string;
  message: string;
  timestamp: Date;
  context?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

function createSSEError(
  type: SSEError['type'],
  code: string,
  message: string,
  context?: any,
  severity: SSEError['severity'] = 'medium'
): SSEError {
  return {
    type,
    code,
    message,
    timestamp: new Date(),
    context,
    severity
  };
}

function logSSEError(error: SSEError): void {
  const logMessage = `[SSE:${error.code}] ${error.message}`;
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

function safeJSONStringify(data: any): string {
  try {
    return JSON.stringify(data);
  } catch (error) {
    logSSEError(createSSEError(
      'system',
      'JSON_STRINGIFY_ERROR',
      'Failed to stringify data for SSE',
      { data, error },
      'medium'
    ));
    return JSON.stringify({ error: 'Data serialization failed' });
  }
}

function safeSSEWrite(response: VercelResponse, data: string, connectionId: string): boolean {
  try {
    response.write(data);
    return true;
  } catch (error) {
    logSSEError(createSSEError(
      'connection',
      'WRITE_ERROR',
      'Failed to write to SSE connection',
      { error, connectionId },
      'medium'
    ));
    return false;
  }
}

/**
 * Optimized SSE Connection Manager with performance monitoring
 */
class OptimizedSSEConnectionManager {
  private connections: Map<string, SSEConnection> = new Map();
  private broadcastCount: number = 0;
  private lastBroadcast: number = Date.now();
  private connectionMetrics: Map<string, { messagesReceived: number; connectedAt: number }> = new Map();

  addConnection(connection: SSEConnection): void {
    this.connections.set(connection.id, connection);
    this.connectionMetrics.set(connection.id, {
      messagesReceived: 0,
      connectedAt: Date.now()
    });
    
    // Setup connection cleanup on close
    connection.response.on('close', () => {
      this.removeConnection(connection.id);
    });
  }

  removeConnection(connectionId: string): void {
    this.connections.delete(connectionId);
    this.connectionMetrics.delete(connectionId);
  }

  broadcastEvent(event: ChallengeCompletionEvent): void {
    const eventData = safeJSONStringify({
      id: event.id,
      type: 'challenge_completed',
      data: {
        playerId: event.playerId,
        playerName: event.playerName,
        challengeId: event.challengeId,
        challengeName: event.challengeName,
        completedAt: event.completedAt.toISOString(),
        points: event.points
      },
      timestamp: event.timestamp.toISOString()
    });

    const failedConnections: string[] = [];
    let successCount = 0;

    for (const [connectionId, connection] of this.connections.entries()) {
      try {
        const success = safeSSEWrite(connection.response, `id: ${event.id}\n`, connectionId) &&
                       safeSSEWrite(connection.response, `event: challenge_completed\n`, connectionId) &&
                       safeSSEWrite(connection.response, `data: ${eventData}\n\n`, connectionId);
        
        if (success) {
          successCount++;
          // Update connection metrics
          const metrics = this.connectionMetrics.get(connectionId);
          if (metrics) {
            metrics.messagesReceived++;
          }
        } else {
          failedConnections.push(connectionId);
        }
      } catch (error) {
        logSSEError(createSSEError(
          'broadcast',
          'BROADCAST_ERROR',
          'Error broadcasting to SSE connection',
          { error, connectionId, eventId: event.id },
          'medium'
        ));
        failedConnections.push(connectionId);
      }
    }

    // Clean up failed connections
    failedConnections.forEach(connectionId => {
      this.removeConnection(connectionId);
    });

    // Update broadcast metrics
    this.broadcastCount++;
    this.lastBroadcast = Date.now();

    if (failedConnections.length > 0) {
      logSSEError(createSSEError(
        'broadcast',
        'PARTIAL_BROADCAST_FAILURE',
        `Failed to broadcast to ${failedConnections.length} connections`,
        { 
          failedConnections, 
          eventId: event.id, 
          totalConnections: this.connections.size,
          successCount 
        },
        'low'
      ));
    }
  }

  getActiveConnections(): SSEConnection[] {
    return Array.from(this.connections.values());
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    connectionCount: number;
    totalBroadcasts: number;
    lastBroadcast: Date;
    averageConnectionAge: number;
    connectionMetrics: Array<{ id: string; messagesReceived: number; ageMs: number }>;
  } {
    const now = Date.now();
    const connectionDetails = Array.from(this.connectionMetrics.entries()).map(([id, metrics]) => ({
      id,
      messagesReceived: metrics.messagesReceived,
      ageMs: now - metrics.connectedAt
    }));

    const averageConnectionAge = connectionDetails.length > 0
      ? connectionDetails.reduce((sum, conn) => sum + conn.ageMs, 0) / connectionDetails.length
      : 0;

    return {
      connectionCount: this.connections.size,
      totalBroadcasts: this.broadcastCount,
      lastBroadcast: new Date(this.lastBroadcast),
      averageConnectionAge: Math.round(averageConnectionAge),
      connectionMetrics: connectionDetails
    };
  }

  /**
   * Cleanup stale connections
   */
  cleanupStaleConnections(maxAge: number = 300000): number { // 5 minutes default
    const now = Date.now();
    const staleConnections: string[] = [];

    for (const [connectionId, metrics] of this.connectionMetrics.entries()) {
      if (now - metrics.connectedAt > maxAge) {
        staleConnections.push(connectionId);
      }
    }

    staleConnections.forEach(connectionId => {
      const connection = this.connections.get(connectionId);
      if (connection) {
        try {
          connection.response.end();
        } catch (error) {
          // Ignore errors when closing stale connections
        }
      }
      this.removeConnection(connectionId);
    });

    return staleConnections.length;
  }
}

// Global optimized connection manager
const connectionManager = new OptimizedSSEConnectionManager();

/**
 * Simple event store implementation for accessing stored events
 * This would normally import from the webhook endpoint, but for serverless
 * we'll implement a basic version here
 */
class SimpleEventStore implements EventStore {
  private events: Map<string, ChallengeCompletionEvent> = new Map();
  private readonly maxAge = 5 * 60 * 1000; // 5 minutes

  getRecentEvents(since?: Date): ChallengeCompletionEvent[] {
    const cutoff = since || new Date(Date.now() - this.maxAge);
    return Array.from(this.events.values())
      .filter(event => event.timestamp >= cutoff)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  size(): number {
    return this.events.size;
  }
}

// For now, use a simple store. In production, this would be shared with webhook endpoint
const eventStore = new SimpleEventStore();

/**
 * Send initial events to newly connected client with error handling
 */
function sendInitialEvents(connection: SSEConnection, eventStore: EventStore): void {
  try {
    const recentEvents = eventStore.getRecentEvents();
    
    if (recentEvents.length === 0) {
      // Send empty state notification
      const emptyStateData = safeJSONStringify({
        message: 'No recent events',
        timestamp: new Date().toISOString()
      });
      
      safeSSEWrite(connection.response, `event: empty_state\n`, connection.id);
      safeSSEWrite(connection.response, `data: ${emptyStateData}\n\n`, connection.id);
      return;
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    for (const event of recentEvents) {
      try {
        const eventData = safeJSONStringify({
          id: event.id,
          type: 'challenge_completed',
          data: {
            playerId: event.playerId,
            playerName: event.playerName,
            challengeId: event.challengeId,
            challengeName: event.challengeName,
            completedAt: event.completedAt.toISOString(),
            points: event.points
          },
          timestamp: event.timestamp.toISOString()
        });

        const success = safeSSEWrite(connection.response, `id: ${event.id}\n`, connection.id) &&
                       safeSSEWrite(connection.response, `event: challenge_completed\n`, connection.id) &&
                       safeSSEWrite(connection.response, `data: ${eventData}\n\n`, connection.id);
        
        if (success) {
          successCount++;
        } else {
          failureCount++;
          break; // Stop sending if we encounter write errors
        }
      } catch (error) {
        logSSEError(createSSEError(
          'connection',
          'INITIAL_EVENT_SEND_ERROR',
          'Error sending initial event to new connection',
          { error, connectionId: connection.id, eventId: event.id },
          'medium'
        ));
        failureCount++;
        break;
      }
    }
    
    if (failureCount > 0) {
      logSSEError(createSSEError(
        'connection',
        'PARTIAL_INITIAL_SEND_FAILURE',
        `Failed to send ${failureCount} initial events to connection`,
        { connectionId: connection.id, successCount, failureCount },
        'low'
      ));
    }
  } catch (error) {
    logSSEError(createSSEError(
      'system',
      'INITIAL_EVENTS_ERROR',
      'Error retrieving or sending initial events',
      { error, connectionId: connection.id },
      'medium'
    ));
  }
}

/**
 * Serverless function for Server-Sent Events streaming with comprehensive error handling
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Last-Event-ID');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    const error = createSSEError(
      'validation',
      'METHOD_NOT_ALLOWED',
      `Method ${req.method} not allowed for SSE endpoint`,
      { method: req.method },
      'medium'
    );
    logSSEError(error);
    return res.status(405).json({ 
      error: 'Method not allowed',
      code: error.code,
      timestamp: error.timestamp.toISOString()
    });
  }

  let connectionId: string | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;

  try {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Generate unique connection ID
    connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create connection object
    const connection: SSEConnection = {
      id: connectionId,
      response: res,
      lastEventId: req.headers['last-event-id'] as string,
      connectedAt: new Date()
    };

    // Add to connection manager
    try {
      connectionManager.addConnection(connection);
    } catch (error) {
      const sseError = createSSEError(
        'system',
        'CONNECTION_MANAGER_ERROR',
        'Failed to add connection to manager',
        { error, connectionId },
        'high'
      );
      logSSEError(sseError);
      return res.status(500).json({
        error: 'Failed to establish connection',
        code: sseError.code,
        timestamp: sseError.timestamp.toISOString()
      });
    }

    console.log(`SSE client connected: ${connectionId}`, {
      totalConnections: connectionManager.getConnectionCount(),
      performanceStats: connectionManager.getPerformanceStats()
    });

    // Send initial connection confirmation with performance info
    const performanceStats = connectionManager.getPerformanceStats();
    const connectionData = safeJSONStringify({ 
      connectionId, 
      connectedAt: connection.connectedAt.toISOString(),
      activeConnections: connectionManager.getConnectionCount(),
      performance: {
        totalBroadcasts: performanceStats.totalBroadcasts,
        averageConnectionAge: performanceStats.averageConnectionAge
      }
    });

    const initialSuccess = safeSSEWrite(res, `id: ${connectionId}\n`, connectionId) &&
                          safeSSEWrite(res, `event: connected\n`, connectionId) &&
                          safeSSEWrite(res, `data: ${connectionData}\n\n`, connectionId);

    if (!initialSuccess) {
      const error = createSSEError(
        'connection',
        'INITIAL_WRITE_FAILED',
        'Failed to send initial connection confirmation',
        { connectionId },
        'high'
      );
      logSSEError(error);
      connectionManager.removeConnection(connectionId);
      return;
    }

    // Send recent events to new client
    try {
      sendInitialEvents(connection, eventStore);
    } catch (error) {
      const sseError = createSSEError(
        'system',
        'INITIAL_EVENTS_FAILED',
        'Failed to send initial events to new connection',
        { error, connectionId },
        'medium'
      );
      logSSEError(sseError);
      // Continue with connection even if initial events fail
    }

    // Track last seen event timestamp for polling
    let lastSeenTimestamp = Date.now();

    // Keep connection alive with periodic heartbeat and KV polling
    heartbeatInterval = setInterval(async () => {
      try {
        // Poll Redis for new events
        let redis;
        try {
          redis = await getRedisClient();
          const latestTimestamp = await redis.get('challenge-events:latest');
          if (latestTimestamp && parseInt(latestTimestamp) > lastSeenTimestamp) {
            // New events available - fetch them
            const recentEvents = await redis.lRange('challenge-events:recent', 0, 9);
            
            for (const eventJson of recentEvents) {
              try {
                const event = JSON.parse(eventJson);
                const eventTimestamp = new Date(event.timestamp).getTime();
                
                if (eventTimestamp > lastSeenTimestamp) {
                  // Send this event to the client
                  const eventData = safeJSONStringify({
                    id: event.id,
                    type: 'challenge_completed',
                    data: {
                      playerId: event.playerId,
                      playerName: event.playerName,
                      challengeId: event.challengeId,
                      challengeName: event.challengeName,
                      completedAt: event.completedAt,
                      points: event.points
                    },
                    timestamp: event.timestamp
                  });

                  safeSSEWrite(res, `id: ${event.id}\n`, connectionId!);
                  safeSSEWrite(res, `event: challenge_completed\n`, connectionId!);
                  safeSSEWrite(res, `data: ${eventData}\n\n`, connectionId!);
                  
                  console.log('Sent event to SSE client:', event.id);
                }
              } catch (parseError) {
                console.error('Error parsing event from KV:', parseError);
              }
            }
            
            lastSeenTimestamp = parseInt(latestTimestamp);
          }
        } catch (redisError) {
          console.error('Error polling Redis for events:', redisError);
        } finally {
          if (redis) {
            await redis.disconnect();
          }
        }

        // Cleanup stale connections periodically
        const cleanedCount = connectionManager.cleanupStaleConnections();
        if (cleanedCount > 0) {
          console.log(`Cleaned up ${cleanedCount} stale SSE connections`);
        }

        const heartbeatData = safeJSONStringify({ 
          timestamp: new Date().toISOString(),
          activeConnections: connectionManager.getConnectionCount(),
          performance: connectionManager.getPerformanceStats()
        });
        
        const success = safeSSEWrite(res, `event: heartbeat\n`, connectionId!) &&
                       safeSSEWrite(res, `data: ${heartbeatData}\n\n`, connectionId!);
        
        if (!success) {
          throw new Error('Heartbeat write failed');
        }
      } catch (error) {
        logSSEError(createSSEError(
          'connection',
          'HEARTBEAT_ERROR',
          'Heartbeat failed for SSE connection',
          { error, connectionId },
          'low'
        ));
        
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
        connectionManager.removeConnection(connectionId!);
      }
    }, 2000); // Poll every 2 seconds for near real-time updates

    // Handle client disconnect with performance logging
    req.on('close', () => {
      const performanceStats = connectionManager.getPerformanceStats();
      console.log(`SSE client disconnected: ${connectionId}`, {
        remainingConnections: connectionManager.getConnectionCount() - 1,
        performanceStats
      });
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (connectionId) {
        connectionManager.removeConnection(connectionId);
      }
    });

    // Handle connection errors
    res.on('error', (error: any) => {
      logSSEError(createSSEError(
        'connection',
        'CONNECTION_ERROR',
        'SSE connection error occurred',
        { error, connectionId },
        'medium'
      ));
      
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (connectionId) {
        connectionManager.removeConnection(connectionId);
      }
    });

    // Handle response finish/end
    res.on('finish', () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (connectionId) {
        connectionManager.removeConnection(connectionId);
      }
    });

  } catch (error: any) {
    const sseError = createSSEError(
      'system',
      'SETUP_ERROR',
      'Error setting up SSE connection',
      { 
        error,
        stack: error.stack,
        connectionId,
        userAgent: req.headers['user-agent']
      },
      'critical'
    );
    logSSEError(sseError);
    
    // Cleanup on error
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    if (connectionId) {
      connectionManager.removeConnection(connectionId);
    }
    
    // Only send JSON response if headers haven't been sent
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Failed to establish SSE connection',
        code: sseError.code,
        timestamp: sseError.timestamp.toISOString()
      });
    }
  }
}

// Export connection manager for webhook endpoint to use
export { connectionManager };