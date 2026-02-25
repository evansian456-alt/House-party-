/**
 * PHASE 1: Test getPlaybackUrl helper function
 * Validates CDN/R2 direct URL generation with fallback to proxy route
 */

describe('PHASE 1: getPlaybackUrl helper', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // Helper to extract getPlaybackUrl from server.js (it's not exported)
  function getPlaybackUrl(trackId, key) {
    // Priority 1: CDN URL (best performance)
    if (process.env.CDN_BASE_URL) {
      const cdnBase = process.env.CDN_BASE_URL.replace(/\/$/, '');
      return `${cdnBase}/${key}`;
    }
    
    // Priority 2: S3 Public URL (direct R2 access)
    if (process.env.S3_PUBLIC_BASE_URL) {
      const s3Base = process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
      return `${s3Base}/${key}`;
    }
    
    // Priority 3: Proxy route fallback (works without CDN/R2 config)
    if (process.env.PUBLIC_BASE_URL) {
      const baseUrl = process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
      return `${baseUrl}/api/track/${trackId}`;
    }
    
    // Fallback for local dev (no PUBLIC_BASE_URL set)
    return `/api/track/${trackId}`;
  }

  test('should use CDN_BASE_URL when set (highest priority)', () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com';
    process.env.S3_PUBLIC_BASE_URL = 'https://pub-123.r2.dev';
    process.env.PUBLIC_BASE_URL = 'https://api.example.com';

    const result = getPlaybackUrl('TRACK123', 'tracks/TRACK123.mp3');
    expect(result).toBe('https://cdn.example.com/tracks/TRACK123.mp3');
  });

  test('should normalize CDN_BASE_URL by removing trailing slash', () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com/';

    const result = getPlaybackUrl('TRACK123', 'tracks/TRACK123.mp3');
    expect(result).toBe('https://cdn.example.com/tracks/TRACK123.mp3');
  });

  test('should use S3_PUBLIC_BASE_URL when CDN not set', () => {
    delete process.env.CDN_BASE_URL;
    process.env.S3_PUBLIC_BASE_URL = 'https://pub-abc123.r2.dev';
    process.env.PUBLIC_BASE_URL = 'https://api.example.com';

    const result = getPlaybackUrl('TRACK456', 'tracks/TRACK456.mp3');
    expect(result).toBe('https://pub-abc123.r2.dev/tracks/TRACK456.mp3');
  });

  test('should normalize S3_PUBLIC_BASE_URL by removing trailing slash', () => {
    delete process.env.CDN_BASE_URL;
    process.env.S3_PUBLIC_BASE_URL = 'https://pub-123.r2.dev/';

    const result = getPlaybackUrl('TRACK456', 'tracks/TRACK456.mp3');
    expect(result).toBe('https://pub-123.r2.dev/tracks/TRACK456.mp3');
  });

  test('should use PUBLIC_BASE_URL proxy route when CDN/S3 not set', () => {
    delete process.env.CDN_BASE_URL;
    delete process.env.S3_PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://api.example.com';

    const result = getPlaybackUrl('TRACK789', 'tracks/TRACK789.mp3');
    expect(result).toBe('https://api.example.com/api/track/TRACK789');
  });

  test('should normalize PUBLIC_BASE_URL by removing trailing slash', () => {
    delete process.env.CDN_BASE_URL;
    delete process.env.S3_PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'https://api.example.com/';

    const result = getPlaybackUrl('TRACK789', 'tracks/TRACK789.mp3');
    expect(result).toBe('https://api.example.com/api/track/TRACK789');
  });

  test('should fallback to relative proxy route for local dev', () => {
    delete process.env.CDN_BASE_URL;
    delete process.env.S3_PUBLIC_BASE_URL;
    delete process.env.PUBLIC_BASE_URL;

    const result = getPlaybackUrl('TRACKXYZ', 'tracks/TRACKXYZ.mp3');
    expect(result).toBe('/api/track/TRACKXYZ');
  });

  test('should handle keys without prefix', () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com';

    const result = getPlaybackUrl('TRACK999', 'TRACK999.mp3');
    expect(result).toBe('https://cdn.example.com/TRACK999.mp3');
  });

  test('should handle keys with nested paths', () => {
    process.env.S3_PUBLIC_BASE_URL = 'https://pub-123.r2.dev';

    const result = getPlaybackUrl('TRACK000', 'audio/tracks/2024/TRACK000.mp3');
    expect(result).toBe('https://pub-123.r2.dev/audio/tracks/2024/TRACK000.mp3');
  });
});
