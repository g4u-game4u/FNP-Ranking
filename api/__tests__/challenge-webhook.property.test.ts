/**
 * Property-based tests for challenge webhook endpoint
 * Tests webhook data processing and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { parseWebhookPayload, validateWebhookSignature } from '../utils/webhook-utils';

// Mock the webhook handler
const mockWebhookHandler = vi.fn();
const mockEventStore = {
  addEvent: vi.fn(),
  getRecentEvents: vi.fn(() => []),
  cleanup: vi.fn(),
  size: vi.fn(() => 0)
};

// Mock the crypto module for signature validation
vi.mock('crypto', () => ({
  default: {
    createHmac: vi.fn(() => ({
      update: vi.fn(() => ({
        digest: vi.fn(() => 'mocked-signature')
      }))
    })),
    timingSafeEqual: vi.fn(() => true)
  }
}));

// Mock process.env
const originalEnv = process.env;

describe('Challenge Webhook Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  /**
   * **Feature: challenge-completion-notifications, Property 1: Webhook event processing**
   * **Validates: Requirements 1.1**
   * 
   * For any valid WebSocket message containing challenge completion data, 
   * the system should parse and extract all completion details without loss or corruption
   */
  it('should process valid webhook payloads correctly', () => {
    fc.assert(
      fc.property(
        // Generate valid webhook payloads
        fc.record({
          eventType: fc.constant('challenge_completed'),
          data: fc.record({
            playerId: fc.string({ minLength: 1, maxLength: 50 }),
            playerName: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            challengeId: fc.string({ minLength: 1, maxLength: 50 }),
            challengeName: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
            completedAt: fc.date().map(d => d.toISOString()),
            points: fc.option(fc.integer({ min: 0, max: 10000 }))
          }),
          timestamp: fc.date().map(d => d.toISOString()),
          signature: fc.option(fc.string({ minLength: 10, maxLength: 100 }))
        }),
        (webhookPayload) => {
          // Process the webhook payload
          const result = parseWebhookPayload(webhookPayload);

          // Property: Valid payloads should always be parsed successfully
          expect(result).not.toBeNull();
          
          if (result) {
            // Property: All required fields should be preserved
            expect(result.playerId).toBe(webhookPayload.data.playerId);
            expect(result.challengeId).toBe(webhookPayload.data.challengeId);
            expect(result.completedAt).toEqual(new Date(webhookPayload.data.completedAt));
            expect(result.timestamp).toEqual(new Date(webhookPayload.timestamp));
            
            // Property: Optional fields should have defaults or preserve values
            if (webhookPayload.data.playerName) {
              expect(result.playerName).toBe(webhookPayload.data.playerName);
            } else {
              expect(result.playerName).toBe(`Player ${webhookPayload.data.playerId}`);
            }
            
            if (webhookPayload.data.challengeName) {
              expect(result.challengeName).toBe(webhookPayload.data.challengeName);
            } else {
              expect(result.challengeName).toBe(`Challenge ${webhookPayload.data.challengeId}`);
            }
            
            if (webhookPayload.data.points !== undefined) {
              expect(result.points).toBe(webhookPayload.data.points);
            }
            
            // Property: Event ID should be unique and deterministic
            const expectedId = `${webhookPayload.data.playerId}-${webhookPayload.data.challengeId}-${webhookPayload.timestamp}`;
            expect(result.id).toBe(expectedId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid webhook payloads', () => {
    fc.assert(
      fc.property(
        // Generate invalid webhook payloads
        fc.oneof(
          // Missing eventType
          fc.record({
            data: fc.record({
              playerId: fc.string({ minLength: 1, maxLength: 50 }),
              challengeId: fc.string({ minLength: 1, maxLength: 50 })
            }),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          // Wrong eventType
          fc.record({
            eventType: fc.oneof(
              fc.constant('user_login'),
              fc.constant('challenge_started'),
              fc.constant('invalid_event')
            ),
            data: fc.record({
              playerId: fc.string({ minLength: 1, maxLength: 50 }),
              challengeId: fc.string({ minLength: 1, maxLength: 50 })
            }),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          // Missing required data fields
          fc.record({
            eventType: fc.constant('challenge_completed'),
            data: fc.oneof(
              fc.record({ playerId: fc.string({ minLength: 1, maxLength: 50 }) }), // Missing challengeId
              fc.record({ challengeId: fc.string({ minLength: 1, maxLength: 50 }) }), // Missing playerId
              fc.record({}) // Missing both
            ),
            timestamp: fc.date().map(d => d.toISOString())
          }),
          // Invalid data types
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.string(),
            fc.integer(),
            fc.array(fc.anything())
          )
        ),
        (invalidPayload) => {
          // Process the invalid webhook payload
          const result = parseWebhookPayload(invalidPayload);

          // Property: Invalid payloads should always be rejected
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate webhook signatures correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          payload: fc.string({ minLength: 10, maxLength: 1000 }),
          secret: fc.string({ minLength: 8, maxLength: 64 }),
          signature: fc.option(fc.string({ minLength: 10, maxLength: 100 }))
        }),
        (testCase) => {
          // Set up environment
          process.env.WEBHOOK_SECRET = testCase.secret;
          
          // Test signature validation
          const result = validateWebhookSignature(testCase.payload, testCase.signature);

          // Property: Validation should always return a boolean
          expect(typeof result).toBe('boolean');
          
          // Property: When no signature is provided, should allow in development
          if (!testCase.signature) {
            expect(result).toBe(true);
          }
          
          // Property: When secret is not configured, should allow with warning
          if (!testCase.secret) {
            delete process.env.WEBHOOK_SECRET;
            const resultNoSecret = validateWebhookSignature(testCase.payload, testCase.signature);
            expect(resultNoSecret).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle malformed JSON gracefully', () => {
    fc.assert(
      fc.property(
        // Generate various malformed inputs
        fc.oneof(
          fc.string().filter(s => {
            try {
              JSON.parse(s);
              return false; // Valid JSON, skip
            } catch {
              return true; // Invalid JSON, use
            }
          }),
          fc.constant('{"incomplete": '),
          fc.constant('{"invalid": "json"'),
          fc.constant('null'),
          fc.constant('undefined'),
          fc.constant('')
        ),
        (malformedInput) => {
          let parsedInput;
          try {
            parsedInput = JSON.parse(malformedInput);
          } catch {
            parsedInput = malformedInput;
          }
          
          // Process the malformed input
          const result = parseWebhookPayload(parsedInput);

          // Property: Malformed input should always be rejected gracefully
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate consistent event IDs for identical inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          playerId: fc.string({ minLength: 1, maxLength: 50 }),
          challengeId: fc.string({ minLength: 1, maxLength: 50 }),
          timestamp: fc.date().map(d => d.toISOString())
        }),
        (eventData) => {
          const webhookPayload = {
            eventType: 'challenge_completed' as const,
            data: {
              playerId: eventData.playerId,
              challengeId: eventData.challengeId,
              completedAt: eventData.timestamp
            },
            timestamp: eventData.timestamp
          };
          
          // Process the same payload multiple times
          const result1 = parseWebhookPayload(webhookPayload);
          const result2 = parseWebhookPayload(webhookPayload);

          // Property: Identical inputs should produce identical event IDs
          expect(result1).not.toBeNull();
          expect(result2).not.toBeNull();
          
          if (result1 && result2) {
            expect(result1.id).toBe(result2.id);
            expect(result1.playerId).toBe(result2.playerId);
            expect(result1.challengeId).toBe(result2.challengeId);
            expect(result1.completedAt.getTime()).toBe(result2.completedAt.getTime());
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});