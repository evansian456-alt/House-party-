/**
 * Phase 9 - Adaptive Lead Time Tests
 * Tests for dynamic leadMs calculation based on p90 + jitter, clamped to 1500-5000ms
 */

const { SyncEngine } = require('./sync-engine');

describe('Phase 9 - Adaptive Lead Time', () => {
  let syncEngine;
  
  beforeEach(() => {
    syncEngine = new SyncEngine();
  });

  describe('calculateAdaptiveLeadTime', () => {
    test('should return minimum 1500ms when p90 is 0', () => {
      const leadTime = syncEngine.calculateAdaptiveLeadTime(0);
      
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
    
    test('should add jitter margin to p90', () => {
      const p90 = 1000; // 1000ms p90
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Should add at least 300ms (minimum jitter) to 1000ms = 1300ms
      // Clamped to minimum 1500ms
      expect(leadTime).toBeGreaterThanOrEqual(1500);
    });
    
    test('should clamp to maximum 5000ms', () => {
      const p90 = 10000; // Very high p90 (10 seconds)
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      expect(leadTime).toBe(5000); // Should be clamped to max
    });
    
    test('should clamp to minimum 1500ms', () => {
      const p90 = 100; // Very low p90 (100ms)
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      expect(leadTime).toBeGreaterThanOrEqual(1500); // Should be clamped to min
    });
    
    test('should calculate adaptive lead time for typical p90', () => {
      const p90 = 2000; // 2000ms p90
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // 2000ms + 20% jitter (400ms minimum) = 2400ms minimum
      // Should be between 1500-5000ms
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
      expect(leadTime).toBeGreaterThan(2000); // Should be higher than p90 due to jitter
    });
    
    test('should add minimum 300ms jitter margin', () => {
      const p90 = 1500; // 1500ms p90
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // 1500ms + 300ms (minimum jitter) = 1800ms
      expect(leadTime).toBeGreaterThanOrEqual(1800);
    });
    
    test('should add 20% jitter for larger p90 values', () => {
      const p90 = 3000; // 3000ms p90
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // 3000ms + 20% (600ms) = 3600ms
      // Should be around 3600ms (may vary slightly due to network stability)
      expect(leadTime).toBeGreaterThanOrEqual(3600);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
  });

  describe('network stability adjustment', () => {
    test('should increase lead time for poor network stability', () => {
      // Add clients with poor network stability
      const ws1 = { readyState: 1 };
      const ws2 = { readyState: 1 };
      
      const client1 = syncEngine.addClient(ws1, 'client-1');
      const client2 = syncEngine.addClient(ws2, 'client-2');
      
      // Set poor network stability (0.5)
      client1.networkStability = 0.5;
      client2.networkStability = 0.5;
      
      const p90 = 2000;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // With poor stability, should add up to 500ms boost
      // 2000ms + 400ms jitter + ~500ms stability = ~2900ms
      expect(leadTime).toBeGreaterThan(2000);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
    
    test('should not adjust lead time for good network stability', () => {
      // Add clients with good network stability
      const ws1 = { readyState: 1 };
      const ws2 = { readyState: 1 };
      
      const client1 = syncEngine.addClient(ws1, 'client-1');
      const client2 = syncEngine.addClient(ws2, 'client-2');
      
      // Set good network stability (1.0)
      client1.networkStability = 1.0;
      client2.networkStability = 1.0;
      
      const p90 = 2000;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // With good stability (>=0.7), no boost should be added
      // 2000ms + 400ms jitter = 2400ms
      expect(leadTime).toBeGreaterThanOrEqual(2400);
      expect(leadTime).toBeLessThan(3000); // Should not have stability boost
    });
    
    test('should handle mixed network stability', () => {
      // Add clients with mixed network stability
      const ws1 = { readyState: 1 };
      const ws2 = { readyState: 1 };
      const ws3 = { readyState: 1 };
      
      const client1 = syncEngine.addClient(ws1, 'client-1');
      const client2 = syncEngine.addClient(ws2, 'client-2');
      const client3 = syncEngine.addClient(ws3, 'client-3');
      
      // Set mixed stability: avg = (1.0 + 0.8 + 0.6) / 3 = 0.8
      client1.networkStability = 1.0;
      client2.networkStability = 0.8;
      client3.networkStability = 0.6;
      
      const p90 = 2000;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Average stability is 0.8, which is > 0.7, so no boost
      expect(leadTime).toBeGreaterThanOrEqual(2400);
      expect(leadTime).toBeLessThan(3000);
    });
  });

  describe('edge cases', () => {
    test('should handle no clients', () => {
      const p90 = 2000;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Should still work with no clients
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
    
    test('should handle undefined p90', () => {
      const leadTime = syncEngine.calculateAdaptiveLeadTime(undefined);
      
      // Should treat as 0 and return minimum
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
    
    test('should handle negative p90', () => {
      const leadTime = syncEngine.calculateAdaptiveLeadTime(-100);
      
      // Should treat as 0 and return minimum
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
    
    test('should handle null p90', () => {
      const leadTime = syncEngine.calculateAdaptiveLeadTime(null);
      
      // Should treat as 0 and return minimum
      expect(leadTime).toBeGreaterThanOrEqual(1500);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
  });

  describe('lead time range validation', () => {
    test('should always return value between 1500-5000ms', () => {
      const testValues = [0, 100, 500, 1000, 1500, 2000, 3000, 4000, 5000, 10000, 20000];
      
      testValues.forEach(p90 => {
        const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
        expect(leadTime).toBeGreaterThanOrEqual(1500);
        expect(leadTime).toBeLessThanOrEqual(5000);
      });
    });
    
    test('should return integer values', () => {
      const p90Values = [1234, 2345, 3456, 4567];
      
      p90Values.forEach(p90 => {
        const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
        expect(Number.isInteger(leadTime)).toBe(true);
      });
    });
  });

  describe('jitter calculation', () => {
    test('should use minimum jitter of 300ms for small p90', () => {
      const p90 = 500; // 20% of 500 = 100ms, which is less than 300ms
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // 500ms + 300ms (minimum jitter) = 800ms
      // Clamped to 1500ms minimum
      expect(leadTime).toBeGreaterThanOrEqual(1500);
    });
    
    test('should use 20% jitter for larger p90', () => {
      const p90 = 2500; // 20% of 2500 = 500ms, which is greater than 300ms
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // 2500ms + 500ms = 3000ms
      expect(leadTime).toBeGreaterThanOrEqual(3000);
      expect(leadTime).toBeLessThanOrEqual(5000);
    });
  });

  describe('practical scenarios', () => {
    test('should handle fast network (low p90)', () => {
      // Fast network with p90 = 800ms
      const p90 = 800;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Should return minimum 1500ms for fast networks
      expect(leadTime).toBe(1500);
    });
    
    test('should handle typical network (medium p90)', () => {
      // Typical network with p90 = 2500ms
      const p90 = 2500;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Should be around 3000-3500ms
      expect(leadTime).toBeGreaterThanOrEqual(3000);
      expect(leadTime).toBeLessThanOrEqual(3500);
    });
    
    test('should handle slow network (high p90)', () => {
      // Slow network with p90 = 4500ms
      const p90 = 4500;
      const leadTime = syncEngine.calculateAdaptiveLeadTime(p90);
      
      // Should be capped at 5000ms
      expect(leadTime).toBe(5000);
    });
  });
});
