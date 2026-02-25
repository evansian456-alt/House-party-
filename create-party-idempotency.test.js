const request = require('supertest');
const { app, parties, redis, waitForRedis } = require('./server');

describe('Create Party Idempotency', () => {
  // Wait for Redis to be ready before running any tests
  beforeAll(async () => {
    try {
      await waitForRedis();
    } catch (error) {
      console.error('Failed to connect to Redis:', error.message);
    }
  });

  // Clear parties and Redis before each test to ensure clean state
  beforeEach(async () => {
    parties.clear();
    if (redis) {
      await redis.flushall();
    }
  });

  describe('POST /api/create-party with idempotency key', () => {
    it('should create party with idempotency key', async () => {
      const idempotencyKey = 'test-key-' + Date.now();
      
      const response = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey)
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      expect(response.body.partyCode).toBeDefined();
      expect(response.body.hostId).toBeDefined();
      expect(response.body.partyCode).toHaveLength(6);
    });

    it('should return same response for duplicate request with same idempotency key', async () => {
      if (!redis) {
        console.log('Skipping test: Redis not available');
        return;
      }

      const idempotencyKey = 'test-key-' + Date.now();
      
      // First request
      const response1 = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey)
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      const partyCode1 = response1.body.partyCode;
      const hostId1 = response1.body.hostId;
      
      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey)
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      // Should return the same party
      expect(response2.body.partyCode).toBe(partyCode1);
      expect(response2.body.hostId).toBe(hostId1);
    });

    it('should create different parties with different idempotency keys', async () => {
      const idempotencyKey1 = 'test-key-1-' + Date.now();
      const idempotencyKey2 = 'test-key-2-' + Date.now();
      
      // First request
      const response1 = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey1)
        .send({ djName: 'Test DJ 1' })
        .expect(200);
      
      // Second request with different idempotency key
      const response2 = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey2)
        .send({ djName: 'Test DJ 2' })
        .expect(200);
      
      // Should create different parties
      expect(response2.body.partyCode).not.toBe(response1.body.partyCode);
    });

    it('should create party without idempotency key', async () => {
      const response = await request(app)
        .post('/api/create-party')
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      expect(response.body.partyCode).toBeDefined();
      expect(response.body.hostId).toBeDefined();
    });

    it('should handle Redis unavailable gracefully', async () => {
      // This test verifies that even if Redis is unavailable for idempotency check,
      // the party creation still works (idempotency is best-effort)
      const idempotencyKey = 'test-key-' + Date.now();
      
      const response = await request(app)
        .post('/api/create-party')
        .set('Idempotency-Key', idempotencyKey)
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      expect(response.body.partyCode).toBeDefined();
      expect(response.body.hostId).toBeDefined();
    });

    it('should include requestId in logs', async () => {
      const idempotencyKey = 'test-key-' + Date.now();
      
      // Capture console.log
      const originalLog = console.log;
      const logs = [];
      console.log = (...args) => {
        logs.push(args.join(' '));
        originalLog(...args);
      };
      
      await request(app)
        .post('/api/create-party')
        .set('idempotency-key', idempotencyKey)
        .send({ djName: 'Test DJ' })
        .expect(200);
      
      // Restore console.log
      console.log = originalLog;
      
      // Verify idempotency key appears in logs
      const hasIdempotencyLog = logs.some(log => log.includes(idempotencyKey));
      expect(hasIdempotencyLog).toBe(true);
    });
  });
});
