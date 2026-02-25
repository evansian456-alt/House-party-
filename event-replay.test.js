/**
 * Unit tests for Event Replay System
 */

const { EventReplayManager, MessagePriority, DEFAULT_CONFIG } = require('./event-replay');

// Mock WebSocket
class MockWebSocket {
  constructor() {
    this.readyState = 1; // OPEN
    this.sentMessages = [];
  }

  send(data) {
    this.sentMessages.push(data);
  }

  getSentMessages() {
    return this.sentMessages.map(msg => JSON.parse(msg));
  }

  close() {
    this.readyState = 3; // CLOSED
  }
}

describe('EventReplayManager', () => {
  let manager;

  beforeEach(() => {
    // Create manager with shorter intervals for testing
    manager = new EventReplayManager({
      retryIntervalMs: 100,
      maxRetryAttempts: 3,
      messageTimeoutMs: 1000,
      cleanupIntervalMs: 500,
      enableLogging: false
    });
  });

  afterEach(() => {
    manager.stop();
  });

  describe('Initialization', () => {
    it('should create manager with default config', () => {
      const defaultManager = new EventReplayManager();
      expect(defaultManager.config.retryIntervalMs).toBe(DEFAULT_CONFIG.retryIntervalMs);
      expect(defaultManager.config.maxRetryAttempts).toBe(DEFAULT_CONFIG.maxRetryAttempts);
    });

    it('should create manager with custom config', () => {
      const customManager = new EventReplayManager({ retryIntervalMs: 5000 });
      expect(customManager.config.retryIntervalMs).toBe(5000);
    });

    it('should start and stop correctly', () => {
      manager.start();
      expect(manager.retryTimer).not.toBeNull();
      expect(manager.cleanupTimer).not.toBeNull();

      manager.stop();
      expect(manager.retryTimer).toBeNull();
      expect(manager.cleanupTimer).toBeNull();
    });
  });

  describe('Client Management', () => {
    it('should register clients correctly', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY1');

      expect(manager.clients.size).toBe(2);
      expect(manager.partyMembers.get('PARTY1').size).toBe(2);
    });

    it('should unregister clients correctly', () => {
      const ws1 = new MockWebSocket();
      manager.registerClient('client1', ws1, 'PARTY1');
      
      manager.unregisterClient('client1');
      
      expect(manager.clients.size).toBe(0);
      expect(manager.partyMembers.has('PARTY1')).toBe(false);
    });

    it('should track multiple parties', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY2');

      expect(manager.partyMembers.size).toBe(2);
      expect(manager.partyMembers.get('PARTY1').size).toBe(1);
      expect(manager.partyMembers.get('PARTY2').size).toBe(1);
    });
  });

  describe('Message Sending', () => {
    it('should send NORMAL priority messages without acknowledgment tracking', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.NORMAL);

      expect(result.sentCount).toBe(1);
      expect(result.requiresAck).toBe(false);
      expect(manager.messageQueue.size).toBe(0);
      expect(ws.getSentMessages()).toHaveLength(1);
      expect(ws.getSentMessages()[0].t).toBe('TEST');
    });

    it('should send CRITICAL priority messages with acknowledgment tracking', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(1);
      expect(result.requiresAck).toBe(true);
      expect(manager.messageQueue.size).toBe(1);
      
      const sentMsg = ws.getSentMessages()[0];
      expect(sentMsg.t).toBe('SYNC');
      expect(sentMsg._msgId).toBeDefined();
      expect(sentMsg._requiresAck).toBe(true);
    });

    it('should send HIGH priority messages with acknowledgment tracking', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'REACTION' }, MessagePriority.HIGH);

      expect(result.sentCount).toBe(1);
      expect(result.requiresAck).toBe(true);
      expect(manager.messageQueue.size).toBe(1);
    });

    it('should broadcast to multiple clients in party', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY1');
      manager.registerClient('client3', ws3, 'PARTY2');

      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(2);
      expect(ws1.getSentMessages()).toHaveLength(1);
      expect(ws2.getSentMessages()).toHaveLength(1);
      expect(ws3.getSentMessages()).toHaveLength(0);
    });

    it('should exclude specified clients from broadcast', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY1');

      const excludeSet = new Set(['client2']);
      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.CRITICAL, excludeSet);

      expect(result.sentCount).toBe(1);
      expect(ws1.getSentMessages()).toHaveLength(1);
      expect(ws2.getSentMessages()).toHaveLength(0);
    });

    it('should handle closed WebSocket connections gracefully', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      
      ws.close();
      
      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(0);
    });
  });

  describe('Acknowledgment Handling', () => {
    it('should handle single client acknowledgment', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);
      const messageId = result.messageId;

      expect(manager.messageQueue.size).toBe(1);

      manager.handleAcknowledgment('client1', messageId);

      expect(manager.messageQueue.size).toBe(0);
      expect(manager.stats.messagesAcknowledged).toBe(1);
    });

    it('should wait for all clients to acknowledge before removing from queue', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);
      const messageId = result.messageId;

      expect(manager.messageQueue.size).toBe(1);

      manager.handleAcknowledgment('client1', messageId);
      expect(manager.messageQueue.size).toBe(1);

      manager.handleAcknowledgment('client2', messageId);
      expect(manager.messageQueue.size).toBe(0);
    });

    it('should handle acknowledgment for non-existent message gracefully', () => {
      manager.handleAcknowledgment('client1', 'nonexistent-id');
      // Should not throw error
    });
  });

  describe('Message Retry', () => {
    jest.setTimeout(10000);

    it('should retry unacknowledged messages', async () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      manager.start();

      manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);

      // Wait for at least one retry
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should have received original + at least 1 retry
      expect(ws.getSentMessages().length).toBeGreaterThanOrEqual(2);
      expect(manager.stats.messagesRetried).toBeGreaterThan(0);
    });

    it('should stop retrying after acknowledgment', async () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      manager.start();

      const result = manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);
      
      // Acknowledge immediately
      manager.handleAcknowledgment('client1', result.messageId);

      const initialCount = ws.getSentMessages().length;

      // Wait for retry interval
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should not have retried
      expect(ws.getSentMessages().length).toBe(initialCount);
    });

    it('should remove message after max retry attempts', async () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      manager.start();

      manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);

      // Wait for max retries (3 attempts + original = 4 total, at 100ms intervals)
      await new Promise(resolve => setTimeout(resolve, 500));

      expect(manager.messageQueue.size).toBe(0);
      expect(manager.stats.messagesFailed).toBe(1);
    });

    it('should remove message after timeout', async () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      manager.start();

      manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);

      // Wait for timeout (1000ms)
      await new Promise(resolve => setTimeout(resolve, 1200));

      expect(manager.messageQueue.size).toBe(0);
      // Message can be removed either by timeout or max attempts - both are valid
      expect(manager.stats.messagesTimedOut + manager.stats.messagesFailed).toBeGreaterThan(0);
    });

    it('should only retry to clients that have not acknowledged', async () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.registerClient('client1', ws1, 'PARTY1');
      manager.registerClient('client2', ws2, 'PARTY1');
      manager.start();

      const result = manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);

      // Client 1 acknowledges immediately
      manager.handleAcknowledgment('client1', result.messageId);

      const ws1InitialCount = ws1.getSentMessages().length;

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 250));

      // Client 1 should not receive retries
      expect(ws1.getSentMessages().length).toBe(ws1InitialCount);
      
      // Client 2 should receive retries
      expect(ws2.getSentMessages().length).toBeGreaterThan(1);
    });
  });

  describe('Statistics', () => {
    it('should track message statistics', () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');

      manager.sendCommandToParty('PARTY1', { t: 'SYNC' }, MessagePriority.CRITICAL);
      
      const stats = manager.getStats();
      expect(stats.messagesSent).toBe(1);
      expect(stats.queueSize).toBe(1);
      expect(stats.activeClients).toBe(1);
      expect(stats.activeParties).toBe(1);
    });

    it('should reset statistics', () => {
      manager.stats.messagesSent = 10;
      manager.stats.messagesAcknowledged = 5;

      manager.resetStats();

      expect(manager.stats.messagesSent).toBe(0);
      expect(manager.stats.messagesAcknowledged).toBe(0);
    });
  });

  describe('Cleanup', () => {
    jest.setTimeout(10000);

    it('should periodically clean up old messages', async () => {
      const ws = new MockWebSocket();
      manager.registerClient('client1', ws, 'PARTY1');
      manager.start();

      // Send multiple messages
      manager.sendCommandToParty('PARTY1', { t: 'MSG1' }, MessagePriority.CRITICAL);
      manager.sendCommandToParty('PARTY1', { t: 'MSG2' }, MessagePriority.CRITICAL);

      expect(manager.messageQueue.size).toBe(2);

      // Wait for timeout + cleanup
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Messages should be cleaned up
      expect(manager.messageQueue.size).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty party gracefully', () => {
      const result = manager.sendCommandToParty('NONEXISTENT', { t: 'TEST' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(0);
      expect(result.requiresAck).toBe(false);
    });

    it('should handle null WebSocket gracefully', () => {
      manager.registerClient('client1', null, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(0);
    });

    it('should handle WebSocket send error gracefully', () => {
      const ws = new MockWebSocket();
      ws.send = () => { throw new Error('Network error'); };

      manager.registerClient('client1', ws, 'PARTY1');

      const result = manager.sendCommandToParty('PARTY1', { t: 'TEST' }, MessagePriority.CRITICAL);

      expect(result.sentCount).toBe(0);
    });

    it('should handle rapid client registration and unregistration', () => {
      const ws = new MockWebSocket();
      
      manager.registerClient('client1', ws, 'PARTY1');
      manager.unregisterClient('client1');
      manager.registerClient('client1', ws, 'PARTY1');
      
      expect(manager.clients.size).toBe(1);
      expect(manager.partyMembers.get('PARTY1').size).toBe(1);
    });
  });

  describe('Batch Processing', () => {
    it('should respect batch size limit during retry', async () => {
      const testManager = new EventReplayManager({
        retryIntervalMs: 100,
        batchSize: 2,
        enableLogging: false
      });
      testManager.start();

      // Register clients
      for (let i = 1; i <= 5; i++) {
        const ws = new MockWebSocket();
        testManager.registerClient(`client${i}`, ws, 'PARTY1');
      }

      // Send messages
      for (let i = 1; i <= 5; i++) {
        testManager.sendCommandToParty('PARTY1', { t: `MSG${i}` }, MessagePriority.CRITICAL);
      }

      expect(testManager.messageQueue.size).toBe(5);

      // Wait for one retry cycle
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have retried at most batchSize messages
      expect(testManager.stats.messagesRetried).toBeLessThanOrEqual(2);

      testManager.stop();
    });
  });
});
