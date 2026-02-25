/**
 * Tests for Section 1: Play Guards (Client & Server)
 * Validates that HOST_PLAY is blocked when trackUrl is missing
 */

const request = require('supertest');
const WebSocket = require('ws');

// Mock environment for testing
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.ALLOW_FALLBACK_IN_PRODUCTION = 'true'; // Allow test to run without Redis

describe('Section 1: Play Guards - Prevent Play Without trackUrl', () => {
  let server;
  let wsUrl;

  beforeAll(async () => {
    // Import server module after env is set
    delete require.cache[require.resolve('./server.js')];
    process.env.PORT = '0'; // Use random port
    const { startServer } = require('./server.js');
    server = await startServer();
    const port = server.address().port;
    wsUrl = `ws://localhost:${port}`;
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('Server Guard (handleHostPlay)', () => {
    test('should reject HOST_PLAY when trackUrl missing and party has guests', (done) => {
      const hostWs = new WebSocket(wsUrl);
      let guestWs;

      hostWs.on('open', () => {
        // Host creates party
        hostWs.send(JSON.stringify({
          t: 'CREATE',
          djName: 'TestHost',
          source: 'local'
        }));
      });

      hostWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.t === 'CREATED') {
          const partyCode = msg.code;

          // Guest joins
          guestWs = new WebSocket(wsUrl);
          guestWs.on('open', () => {
            guestWs.send(JSON.stringify({
              t: 'JOIN',
              code: partyCode,
              name: 'TestGuest'
            }));
          });

          guestWs.on('message', (guestData) => {
            const guestMsg = JSON.parse(guestData.toString());

            if (guestMsg.t === 'JOINED') {
              // Now send HOST_PLAY without trackUrl
              hostWs.send(JSON.stringify({
                t: 'HOST_PLAY',
                trackUrl: null, // No trackUrl
                currentTime: 0
              }));
            }
          });
        }

        if (msg.t === 'ERROR') {
          // Expect an error for invalid action
          expect(msg.errorType).toBe('INVALID_ACTION');
          expect(msg.message).toContain('track URL');
          
          // Cleanup
          hostWs.close();
          if (guestWs) guestWs.close();
          done();
        }
      });

      hostWs.on('error', (err) => {
        done(err);
      });
    }, 10000);

    test('should allow HOST_PLAY when trackUrl is present', (done) => {
      const hostWs = new WebSocket(wsUrl);
      let guestWs;
      let receivedPreparePlay = false;

      hostWs.on('open', () => {
        hostWs.send(JSON.stringify({
          t: 'CREATE',
          djName: 'TestHost2',
          source: 'local'
        }));
      });

      hostWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.t === 'CREATED') {
          const partyCode = msg.code;

          guestWs = new WebSocket(wsUrl);
          guestWs.on('open', () => {
            guestWs.send(JSON.stringify({
              t: 'JOIN',
              code: partyCode,
              name: 'TestGuest2'
            }));
          });

          guestWs.on('message', (guestData) => {
            const guestMsg = JSON.parse(guestData.toString());

            if (guestMsg.t === 'JOINED') {
              // Send HOST_PLAY with valid trackUrl
              hostWs.send(JSON.stringify({
                t: 'HOST_PLAY',
                trackUrl: 'http://localhost/api/track/TEST123',
                currentTime: 0
              }));
            }

            if (guestMsg.t === 'PREPARE_PLAY') {
              receivedPreparePlay = true;
              expect(guestMsg.trackUrl).toBe('http://localhost/api/track/TEST123');
              
              // Cleanup
              hostWs.close();
              guestWs.close();
              done();
            }
          });
        }
      });

      hostWs.on('error', (err) => {
        done(err);
      });
    }, 10000);

    test('should allow solo host to play without trackUrl', (done) => {
      const hostWs = new WebSocket(wsUrl);

      hostWs.on('open', () => {
        hostWs.send(JSON.stringify({
          t: 'CREATE',
          djName: 'SoloHost',
          source: 'local'
        }));
      });

      let createdReceived = false;
      hostWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());

        if (msg.t === 'CREATED') {
          createdReceived = true;
          // Solo host sends HOST_PLAY without trackUrl
          hostWs.send(JSON.stringify({
            t: 'HOST_PLAY',
            trackUrl: null,
            currentTime: 0
          }));
          
          // Wait a bit to ensure no error
          setTimeout(() => {
            hostWs.close();
            done();
          }, 500);
        }

        if (msg.t === 'ERROR') {
          done(new Error('Solo host should not receive error for playing without trackUrl'));
        }
      });

      hostWs.on('error', (err) => {
        done(err);
      });
    }, 10000);
  });
});
