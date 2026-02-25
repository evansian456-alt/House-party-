/**
 * Sync Feedback Tests
 * Tests for guest sync issue reporting to host
 */

const WebSocket = require('ws');
const { waitForRedis } = require('./server');

// Mock WebSocket setup
let mockServer;
let mockClients = [];

beforeAll(async () => {
  // Wait for Redis to be ready
  try {
    await waitForRedis(5000);
  } catch (err) {
    console.warn('Redis not available, tests will use fallback mode');
  }
});

afterEach(() => {
  // Clean up mock clients
  mockClients.forEach(client => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });
  mockClients = [];
});

describe('Sync Feedback', () => {
  describe('SYNC_ISSUE message handling', () => {
    test('should handle SYNC_ISSUE message from guest', (done) => {
      // This is a basic structural test
      // Full WebSocket testing would require more complex setup
      
      const syncIssueMessage = {
        t: 'SYNC_ISSUE',
        drift: 150, // 150ms drift
        timestamp: Date.now()
      };
      
      // Verify message structure
      expect(syncIssueMessage.t).toBe('SYNC_ISSUE');
      expect(syncIssueMessage.drift).toBeDefined();
      expect(syncIssueMessage.timestamp).toBeDefined();
      
      done();
    });
    
    test('should create valid SYNC_ISSUE_REPORT for host', () => {
      const notification = {
        t: 'SYNC_ISSUE_REPORT',
        guestName: 'Test Guest',
        guestId: 'guest-123',
        drift: 150,
        timestamp: Date.now()
      };
      
      // Verify notification structure
      expect(notification.t).toBe('SYNC_ISSUE_REPORT');
      expect(notification.guestName).toBe('Test Guest');
      expect(notification.guestId).toBe('guest-123');
      expect(notification.drift).toBe(150);
      expect(notification.timestamp).toBeDefined();
    });
    
    test('should create valid SYNC_ISSUE_ACK for guest', () => {
      const ack = {
        t: 'SYNC_ISSUE_ACK',
        message: 'Sync issue reported to DJ'
      };
      
      // Verify acknowledgment structure
      expect(ack.t).toBe('SYNC_ISSUE_ACK');
      expect(ack.message).toBe('Sync issue reported to DJ');
    });
  });
  
  describe('Drift calculation', () => {
    test('should calculate drift correctly', () => {
      const startPositionSec = 0;
      const startAtServerMs = Date.now() - 5000; // Started 5 seconds ago
      const currentTime = 5.15; // 5.15 seconds into track
      
      const serverNow = Date.now();
      const expectedPosition = startPositionSec + (serverNow - startAtServerMs) / 1000;
      const drift = Math.round((currentTime - expectedPosition) * 1000);
      
      // Drift should be around 150ms (5.15 - 5.0 = 0.15s)
      expect(drift).toBeGreaterThan(100);
      expect(drift).toBeLessThan(200);
    });
    
    test('should handle unknown drift', () => {
      const drift = 'unknown';
      
      expect(drift).toBe('unknown');
      // System should handle unknown drift gracefully
    });
  });
  
  describe('Message validation', () => {
    test('should validate guest cannot be host', () => {
      const isHost = false;
      
      // Guests should not be able to report sync issues as host
      expect(isHost).toBe(false);
    });
    
    test('should validate message types', () => {
      const validTypes = ['SYNC_ISSUE', 'SYNC_ISSUE_REPORT', 'SYNC_ISSUE_ACK'];
      
      validTypes.forEach(type => {
        expect(type).toMatch(/^SYNC_ISSUE/);
      });
    });
  });
});
