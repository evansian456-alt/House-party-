/**
 * Phase 10 - Observability Tests
 * Tests for time_to_ready_ms, start_error_ms, drift_error_ms, and reconnect_count metrics
 */

const RedisMock = require('ioredis-mock');
const { MetricsService } = require('./metrics-service');

describe('Phase 10 - Observability Metrics', () => {
  let redis;
  let metricsService;
  
  beforeEach(() => {
    redis = new RedisMock();
    metricsService = new MetricsService(null, redis);
  });
  
  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('time_to_ready_ms tracking', () => {
    test('should track time_to_ready metric', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      const timeToReadyMs = 850;
      
      await metricsService.trackTimeToReady(partyCode, clientId, timeToReadyMs);
      
      const key = `metrics:time_to_ready:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data).toHaveLength(1);
      const metric = JSON.parse(data[0]);
      expect(metric.clientId).toBe(clientId);
      expect(metric.time_to_ready_ms).toBe(timeToReadyMs);
      expect(metric.timestamp).toBeDefined();
    });
    
    test('should not log PII in time_to_ready metric', async () => {
      const partyCode = 'ABC123';
      // clientId should be an opaque identifier, not containing direct PII
      const clientId = 'client-abc123'; 
      const timeToReadyMs = 1000;
      
      await metricsService.trackTimeToReady(partyCode, clientId, timeToReadyMs);
      
      const key = `metrics:time_to_ready:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      const metric = JSON.parse(data[0]);
      
      // Verify no secrets or sensitive fields beyond opaque clientId
      expect(metric).not.toHaveProperty('password');
      expect(metric).not.toHaveProperty('token');
      expect(metric).not.toHaveProperty('secret');
      expect(metric).not.toHaveProperty('email');
      expect(metric).not.toHaveProperty('apiKey');
    });
    
    test('should keep only last 100 time_to_ready samples', async () => {
      const partyCode = 'ABC123';
      
      // Add 150 samples
      for (let i = 0; i < 150; i++) {
        await metricsService.trackTimeToReady(partyCode, `client-${i}`, 1000 + i);
      }
      
      const key = `metrics:time_to_ready:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data.length).toBeLessThanOrEqual(100);
    });
  });

  describe('start_error_ms tracking', () => {
    test('should track start_error metric', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      const startErrorMs = 45;
      
      await metricsService.trackStartError(partyCode, clientId, startErrorMs);
      
      const key = `metrics:start_error:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data).toHaveLength(1);
      const metric = JSON.parse(data[0]);
      expect(metric.clientId).toBe(clientId);
      expect(metric.start_error_ms).toBe(startErrorMs);
      expect(metric.timestamp).toBeDefined();
    });
    
    test('should handle zero start error', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      const startErrorMs = 0;
      
      await metricsService.trackStartError(partyCode, clientId, startErrorMs);
      
      const key = `metrics:start_error:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data).toHaveLength(1);
      const metric = JSON.parse(data[0]);
      expect(metric.start_error_ms).toBe(0);
    });
  });

  describe('drift_error_ms tracking', () => {
    test('should track drift_error metric', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      const driftErrorMs = 120;
      
      await metricsService.trackDriftError(partyCode, clientId, driftErrorMs);
      
      const key = `metrics:drift_error:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data).toHaveLength(1);
      const metric = JSON.parse(data[0]);
      expect(metric.clientId).toBe(clientId);
      expect(metric.drift_error_ms).toBe(driftErrorMs);
      expect(metric.timestamp).toBeDefined();
    });
    
    test('should track negative drift errors', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      const driftErrorMs = -75;
      
      await metricsService.trackDriftError(partyCode, clientId, driftErrorMs);
      
      const key = `metrics:drift_error:${partyCode}`;
      const data = await redis.lrange(key, 0, -1);
      
      expect(data).toHaveLength(1);
      const metric = JSON.parse(data[0]);
      expect(metric.drift_error_ms).toBe(-75);
    });
  });

  describe('reconnect_count tracking', () => {
    test('should track reconnection event', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      
      await metricsService.trackReconnect(partyCode, clientId);
      
      const key = `metrics:reconnects:${partyCode}`;
      const count = await redis.hget(key, clientId);
      
      expect(parseInt(count)).toBe(1);
    });
    
    test('should increment reconnect count for multiple reconnections', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      
      await metricsService.trackReconnect(partyCode, clientId);
      await metricsService.trackReconnect(partyCode, clientId);
      await metricsService.trackReconnect(partyCode, clientId);
      
      const key = `metrics:reconnects:${partyCode}`;
      const count = await redis.hget(key, clientId);
      
      expect(parseInt(count)).toBe(3);
    });
    
    test('should get total reconnect count for party', async () => {
      const partyCode = 'ABC123';
      
      await metricsService.trackReconnect(partyCode, 'client-1');
      await metricsService.trackReconnect(partyCode, 'client-1');
      await metricsService.trackReconnect(partyCode, 'client-2');
      await metricsService.trackReconnect(partyCode, 'client-3');
      
      const totalCount = await metricsService.getReconnectCount(partyCode);
      
      expect(totalCount).toBe(4); // 2 + 1 + 1
    });
  });

  describe('time_to_ready statistics', () => {
    test('should calculate p90 from time_to_ready samples', async () => {
      const partyCode = 'ABC123';
      
      // Add samples: 100, 200, 300, ..., 1000 (10 samples)
      for (let i = 1; i <= 10; i++) {
        await metricsService.trackTimeToReady(partyCode, `client-${i}`, i * 100);
      }
      
      const stats = await metricsService.getTimeToReadyStats(partyCode);
      
      expect(stats.count).toBe(10);
      expect(stats.avg).toBe(550); // Average of 100..1000
      expect(stats.p90).toBe(1000); // 90th percentile (9th index in sorted array of 10)
      expect(stats.max).toBe(1000);
    });
    
    test('should return zeros when no samples exist', async () => {
      const partyCode = 'NODATA';
      
      const stats = await metricsService.getTimeToReadyStats(partyCode);
      
      expect(stats.count).toBe(0);
      expect(stats.avg).toBe(0);
      expect(stats.p90).toBe(0);
      expect(stats.max).toBe(0);
    });
    
    test('should handle single sample', async () => {
      const partyCode = 'ABC123';
      
      await metricsService.trackTimeToReady(partyCode, 'client-1', 1234);
      
      const stats = await metricsService.getTimeToReadyStats(partyCode);
      
      expect(stats.count).toBe(1);
      expect(stats.avg).toBe(1234);
      expect(stats.p90).toBe(1234); // p90 of single sample is itself
      expect(stats.max).toBe(1234);
    });
  });

  describe('metrics expiry', () => {
    test('should set 1 hour expiry on time_to_ready metrics', async () => {
      const partyCode = 'ABC123';
      
      await metricsService.trackTimeToReady(partyCode, 'client-1', 1000);
      
      const key = `metrics:time_to_ready:${partyCode}`;
      const ttl = await redis.ttl(key);
      
      expect(ttl).toBeGreaterThan(3500); // Should be close to 3600 seconds
      expect(ttl).toBeLessThanOrEqual(3600);
    });
    
    test('should set 1 hour expiry on reconnect metrics', async () => {
      const partyCode = 'ABC123';
      
      await metricsService.trackReconnect(partyCode, 'client-1');
      
      const key = `metrics:reconnects:${partyCode}`;
      const ttl = await redis.ttl(key);
      
      expect(ttl).toBeGreaterThan(3500);
      expect(ttl).toBeLessThanOrEqual(3600);
    });
  });

  describe('no secrets or PII logging', () => {
    test('should not expose sensitive data in metrics', async () => {
      const partyCode = 'ABC123';
      const clientId = 'client-1';
      
      // Track various metrics
      await metricsService.trackTimeToReady(partyCode, clientId, 1000);
      await metricsService.trackStartError(partyCode, clientId, 50);
      await metricsService.trackDriftError(partyCode, clientId, 120);
      
      // Retrieve all metrics
      const timeToReadyKey = `metrics:time_to_ready:${partyCode}`;
      const startErrorKey = `metrics:start_error:${partyCode}`;
      const driftErrorKey = `metrics:drift_error:${partyCode}`;
      
      const timeToReadyData = await redis.lrange(timeToReadyKey, 0, -1);
      const startErrorData = await redis.lrange(startErrorKey, 0, -1);
      const driftErrorData = await redis.lrange(driftErrorKey, 0, -1);
      
      // Verify no sensitive fields
      const allData = [
        ...timeToReadyData.map(d => JSON.parse(d)),
        ...startErrorData.map(d => JSON.parse(d)),
        ...driftErrorData.map(d => JSON.parse(d))
      ];
      
      allData.forEach(metric => {
        expect(metric).not.toHaveProperty('password');
        expect(metric).not.toHaveProperty('token');
        expect(metric).not.toHaveProperty('secret');
        expect(metric).not.toHaveProperty('email');
        expect(metric).not.toHaveProperty('apiKey');
        expect(metric).not.toHaveProperty('jwt');
      });
    });
  });
});
