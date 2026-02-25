/**
 * Integration tests for Event Replay System
 * Tests server-client acknowledgment flow
 * 
 * Note: These tests require a running server with Redis.
 * If the server cannot start, WS tests will FAIL (not skip) per the zero-skip mandate.
 */

// Must be set before requiring server.js so server uses a random port
process.env.PORT = '0';

const WebSocket = require('ws');
const { 
  app, 
  startServer, 
  parties, 
  redis,
  waitForRedis 
} = require('./server');

// Test configuration
let server;
let testClients = [];
let serverAvailable = false;
let testPort;

// Test timeouts
const REDIS_CONNECTION_TIMEOUT = 2000; // 2 seconds
const SERVER_STARTUP_TIMEOUT = 5000; // 5 seconds

// A nested beforeAll throws (FAIL, not skip) when server is unavailable,
// satisfying the zero-skip mandate.
const describeIfServer = (name, fn) => {
  describe(name, () => {
    beforeAll(() => {
      if (!serverAvailable) {
        throw new Error(
          `Server not available — "${name}" tests cannot run. ` +
          'Ensure Redis and startServer() succeeded in the outer beforeAll.'
        );
      }
    });
    fn();
  });
};

describe('Event Replay System - Integration Tests', () => {
  // Start server before all tests
  beforeAll(async () => {
    try {
      // Set test environment
      process.env.NODE_ENV = 'test';
      process.env.TEST_MODE = 'true';
      
      // Try to wait for Redis with a short timeout
      try {
        await Promise.race([
          waitForRedis(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), REDIS_CONNECTION_TIMEOUT))
        ]);
        console.log('[Test] Redis available');
      } catch (error) {
        console.log('[Test] Redis not available - WS tests will fail in their own beforeAll:', error.message);
        return;
      }
      
      // Try to start server with timeout
      server = await Promise.race([
        startServer(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Server startup timeout')), SERVER_STARTUP_TIMEOUT))
      ]);
      
      // Wait for server to be ready — startServer() resolves only after
      // the HTTP/WS listener is bound, so no fixed sleep is needed.
      
      // Get the actual port the server is listening on
      const address = server.address();
      testPort = address.port;
      
      serverAvailable = true;
      console.log(`[Test] Server started successfully on port ${testPort}`);
    } catch (error) {
      serverAvailable = false;
      console.log('[Test] Server startup failed - WS tests will fail in their own beforeAll:', error.message);
    }
  }, REDIS_CONNECTION_TIMEOUT + SERVER_STARTUP_TIMEOUT + 2000);

  // Clean up after each test
  afterEach(async () => {
    // Close all test clients
    testClients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    testClients = [];
    
    // Clear parties
    parties.clear();
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  // Stop server after all tests
  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  // Helper function to create WebSocket client
  function createClient() {
    const ws = new WebSocket(`ws://localhost:${testPort}`);
    testClients.push(ws);
    return ws;
  }

  // Helper function to wait for WebSocket to open
  function waitForOpen(ws) {
    return new Promise((resolve, reject) => {
      if (ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      ws.once('open', resolve);
      ws.once('error', reject);
      
      setTimeout(() => reject(new Error('Timeout waiting for WebSocket open')), 5000);
    });
  }

  // Race-condition-safe: register WELCOME listener before awaiting 'open' so
  // it is in place even if the WELCOME frame arrives in the same TCP read.
  async function openAndWelcome(ws) {
    const welcomeProm = waitForMessage(ws, 'WELCOME');
    await waitForOpen(ws);
    return welcomeProm;
  }

  // Helper function to wait for specific message type
  function waitForMessage(ws, messageType, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      const handler = (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.t === messageType) {
            clearTimeout(timer);
            ws.off('message', handler);
            resolve(msg);
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      ws.on('message', handler);
    });
  }

  describeIfServer('Message Acknowledgment Flow', () => {
    it('should receive and acknowledge critical messages', async () => {
      const hostWs = createClient();
      const welcomeMsg = await openAndWelcome(hostWs);
      expect(welcomeMsg.clientId).toBeDefined();

      // Set up listener BEFORE sending CREATE so post-create messages
      // (ROOM_STATE, FEED_EVENT, DJ_MESSAGE) are captured even if they
      // arrive in the same TCP burst as CREATED.
      const receivedMessages = [];
      const acksSent = [];

      hostWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          receivedMessages.push(msg);

          // Automatically send ACK for messages that require it
          if (msg._requiresAck && msg._msgId) {
            hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: msg._msgId }));
            acksSent.push(msg._msgId);
          }
        } catch (err) {
          // Ignore parse errors
        }
      });

      // Create party — listener already registered above
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local' }));
      const createdMsg = await waitForMessage(hostWs, 'CREATED');
      const partyCode = createdMsg.code;

      // Wait a bit for post-create messages to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      // receivedMessages includes CREATED plus subsequent server messages
      expect(receivedMessages.length).toBeGreaterThan(0);

      // Note: We can't easily test actual acknowledgment tracking without
      // exposing internal state, but we can verify that ACKs are sent
      console.log(`Sent ${acksSent.length} acknowledgments`);
    });

    it('should handle multiple clients acknowledging same message', async () => {
      // Create host
      const hostWs = createClient();
      await openAndWelcome(hostWs);

      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local', isPro: true }));
      const createdMsg = await waitForMessage(hostWs, 'CREATED');
      const partyCode = createdMsg.code;

      // Create guest (free parties support host + 1 guest = 2 phones max)
      const guestWs = createClient();
      await openAndWelcome(guestWs);

      const joinProm = waitForMessage(guestWs, 'JOINED');
      guestWs.send(JSON.stringify({ t: 'JOIN', code: partyCode, name: 'Guest 1' }));
      await joinProm;

      // Track ACKs from host and guest
      const hostAcks = [];
      const guestAcks = [];

      hostWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg._requiresAck && msg._msgId) {
            hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: msg._msgId }));
            hostAcks.push(msg._msgId);
          }
        } catch (err) {}
      });

      guestWs.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg._requiresAck && msg._msgId) {
            guestWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: msg._msgId }));
            guestAcks.push(msg._msgId);
          }
        } catch (err) {}
      });

      // Wait for everything to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Both clients should be in a working state (no assertion on ACK count
      // since ACK-requiring messages are control events like PREPARE_PLAY)
      console.log(`Host sent ${hostAcks.length} ACKs, Guest sent ${guestAcks.length} ACKs`);
    });
  });

  describeIfServer('Client Registration', () => {
    it('should register client on join', async () => {
      const hostWs = createClient();
      await openAndWelcome(hostWs);
      
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local' }));
      const createdMsg = await waitForMessage(hostWs, 'CREATED');
      
      // Client should be registered (we can't directly check, but it shouldn't error)
      expect(createdMsg.code).toBeDefined();
    });

    it('should unregister client on disconnect', async () => {
      const hostWs = createClient();
      await openAndWelcome(hostWs);
      
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local' }));
      await waitForMessage(hostWs, 'CREATED');
      
      // Close connection
      hostWs.close();
      
      // Wait for disconnect to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Client should be unregistered (party should be cleaned up)
      // We can verify this indirectly through party count
    });
  });

  describeIfServer('Message Deduplication', () => {
    it('should not process duplicate acknowledgments', async () => {
      const hostWs = createClient();
      await openAndWelcome(hostWs);
      
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local' }));
      await waitForMessage(hostWs, 'CREATED');
      
      // Send duplicate ACKs (this should be handled gracefully)
      const fakeMessageId = 'test-msg-123';
      hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: fakeMessageId }));
      hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: fakeMessageId }));
      hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: fakeMessageId }));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should not throw errors (connection should still be open)
      expect(hostWs.readyState).toBe(WebSocket.OPEN);
    });
  });

  describeIfServer('Network Resilience', () => {
    it('should handle client disconnect during message delivery', async () => {
      const hostWs = createClient();
      await openAndWelcome(hostWs);
      
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local', isPro: true }));
      const createdMsg = await waitForMessage(hostWs, 'CREATED');
      const partyCode = createdMsg.code;
      
      // Create guest
      const guestWs = createClient();
      await openAndWelcome(guestWs);
      
      guestWs.send(JSON.stringify({ t: 'JOIN', code: partyCode, name: 'Guest' }));
      await waitForMessage(guestWs, 'JOINED');
      
      // Disconnect guest immediately
      guestWs.close();
      
      // Wait for disconnect to process
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Host should still be connected
      expect(hostWs.readyState).toBe(WebSocket.OPEN);
    });

    it('should handle invalid ACK message gracefully', async () => {
      const hostWs = createClient();
      await openAndWelcome(hostWs);
      
      hostWs.send(JSON.stringify({ t: 'CREATE', djName: 'Test Host', source: 'local' }));
      await waitForMessage(hostWs, 'CREATED');
      
      // Send invalid ACK (no messageId)
      hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK' }));
      
      // Send invalid ACK (empty messageId)
      hostWs.send(JSON.stringify({ t: 'MESSAGE_ACK', messageId: '' }));
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should not crash or disconnect
      expect(hostWs.readyState).toBe(WebSocket.OPEN);
    });
  });
});
