/**
 * Environment Validator Tests
 * 
 * Tests the environment variable validation logic
 * NOTE: These tests run in test mode, so they test the basic validation logic
 * Production validation behavior is tested through integration tests
 */

const { validateEnvironment, ENV_SPEC } = require('./env-validator');

describe('Environment Validator', () => {
  let originalEnv;
  
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Validation Logic', () => {
    test('should have validation function', () => {
      expect(typeof validateEnvironment).toBe('function');
    });
    
    test('should return validation result object', () => {
      const result = validateEnvironment();
      
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('hasErrors');
      expect(result).toHaveProperty('hasWarnings');
    });
    
    test('should detect insecure JWT_SECRET defaults', () => {
      process.env.JWT_SECRET = 'syncspeaker-no-auth-mode';
      
      const result = validateEnvironment();
      
      // Should at least warn about insecure default
      const jwtIssues = [...result.errors, ...result.warnings].filter(
        issue => issue.variable === 'JWT_SECRET'
      );
      expect(jwtIssues.length).toBeGreaterThan(0);
    });
    
    test('should detect short JWT_SECRET', () => {
      process.env.JWT_SECRET = 'short';
      
      const result = validateEnvironment();
      
      // Should warn about length
      const jwtIssues = [...result.errors, ...result.warnings].filter(
        issue => issue.variable === 'JWT_SECRET'
      );
      expect(jwtIssues.length).toBeGreaterThan(0);
    });
    
    test('should detect dangerous ALLOW_FALLBACK_IN_PRODUCTION setting', () => {
      process.env.ALLOW_FALLBACK_IN_PRODUCTION = 'true';
      process.env.NODE_ENV = 'production';
      
      const result = validateEnvironment();
      
      // Should error on dangerous setting
      const fallbackIssues = [...result.errors, ...result.warnings].filter(
        issue => issue.variable === 'ALLOW_FALLBACK_IN_PRODUCTION'
      );
      expect(fallbackIssues.length).toBeGreaterThan(0);
    });
    
    test('should accept valid configuration', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      process.env.DATABASE_URL = 'postgresql://localhost:5432/test';
      process.env.JWT_SECRET = 'secure-random-secret-at-least-32-characters-long';
      process.env.NODE_ENV = 'development';
      
      const result = validateEnvironment();
      
      // Should not have errors for valid config
      expect(result.hasErrors()).toBe(false);
    });
  });
  
  describe('ENV_SPEC', () => {
    test('should define all critical variables', () => {
      expect(ENV_SPEC).toHaveProperty('REDIS_URL');
      expect(ENV_SPEC).toHaveProperty('DATABASE_URL');
      expect(ENV_SPEC).toHaveProperty('JWT_SECRET');
      expect(ENV_SPEC).toHaveProperty('NODE_ENV');
    });
    
    test('should mark REDIS_URL as Redis category', () => {
      expect(ENV_SPEC.REDIS_URL.category).toBe('Redis');
      expect(ENV_SPEC.REDIS_URL.securityImpact).toBe('HIGH');
    });
    
    test('should mark DATABASE_URL as Database category', () => {
      expect(ENV_SPEC.DATABASE_URL.category).toBe('Database');
      expect(ENV_SPEC.DATABASE_URL.securityImpact).toBe('HIGH');
    });
    
    test('should mark JWT_SECRET as strongly recommended with critical impact', () => {
      expect(ENV_SPEC.JWT_SECRET.stronglyRecommended).toBe(true);
      expect(ENV_SPEC.JWT_SECRET.securityImpact).toBe('CRITICAL');
      expect(ENV_SPEC.JWT_SECRET.minLength).toBe(32);
    });
    
    test('should define insecure defaults for JWT_SECRET', () => {
      expect(ENV_SPEC.JWT_SECRET.insecureDefaults).toContain('syncspeaker-no-auth-mode');
      expect(ENV_SPEC.JWT_SECRET.insecureDefaults).toContain('dev-secret-not-for-production');
      expect(ENV_SPEC.JWT_SECRET.insecureDefaults).toContain('test-secret');
    });
    
    test('should mark ALLOW_FALLBACK_IN_PRODUCTION as dangerous', () => {
      expect(ENV_SPEC.ALLOW_FALLBACK_IN_PRODUCTION.dangerous).toBe(true);
      expect(ENV_SPEC.ALLOW_FALLBACK_IN_PRODUCTION.validValues).toEqual(['false']);
    });
    
    test('should define NODE_ENV valid values', () => {
      expect(ENV_SPEC.NODE_ENV.validValues).toEqual(['production', 'development', 'test']);
    });
    
    test('should recommend Sentry in production', () => {
      expect(ENV_SPEC.SENTRY_DSN.recommendedInProduction).toBe(true);
    });
  });
  
  describe('Validation Result', () => {
    test('should format error messages properly', () => {
      const result = validateEnvironment();
      
      expect(typeof result.print).toBe('function');
      
      // Should not throw when printing
      expect(() => result.print()).not.toThrow();
    });
    
    test('should track errors and warnings separately', () => {
      const result = validateEnvironment();
      
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(Array.isArray(result.info)).toBe(true);
    });
  });
});
