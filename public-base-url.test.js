/**
 * Tests for Section 2: PUBLIC_BASE_URL Support
 * Validates that trackUrl uses PUBLIC_BASE_URL in production
 */

const request = require('supertest');
const fs = require('fs');
const path = require('path');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.TEST_MODE = 'true';
process.env.ALLOW_FALLBACK_IN_PRODUCTION = 'true';

describe('Section 2: PUBLIC_BASE_URL Support', () => {
  let server;
  let app;

  const createTestAudioFile = () => {
    const testFile = path.join(__dirname, 'test-audio.mp3');
    // Create a minimal valid MP3 file (just a header)
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 sync word and header
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    fs.writeFileSync(testFile, mp3Header);
    return testFile;
  };

  const cleanupTestFile = (filepath) => {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  };

  beforeAll(() => {
    delete require.cache[require.resolve('./server.js')];
  });

  afterEach(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
      server = null;
    }
  });

  describe('Upload Route trackUrl Generation', () => {
    test('should use PUBLIC_BASE_URL when set', async () => {
      // Set PUBLIC_BASE_URL
      process.env.PUBLIC_BASE_URL = 'https://my-app.railway.app';
      process.env.PORT = '0'; // Use random port

      const { startServer } = require('./server.js');
      server = await startServer();
      const port = server.address().port;
      app = request(`http://localhost:${port}`);

      const testFile = createTestAudioFile();

      try {
        const response = await app
          .post('/api/upload-track')
          .attach('audio', testFile, 'test.mp3')
          .expect(200);

        expect(response.body.ok).toBe(true);
        expect(response.body.trackUrl).toMatch(/^https:\/\/my-app\.railway\.app\/api\/track\//);
        expect(response.body.trackId).toBeDefined();
      } finally {
        cleanupTestFile(testFile);
        delete process.env.PUBLIC_BASE_URL;
      }
    }, 10000);

    test('should use request origin when PUBLIC_BASE_URL not set (dev)', async () => {
      // Ensure PUBLIC_BASE_URL is not set
      delete process.env.PUBLIC_BASE_URL;
      process.env.PORT = '0';

      // Need to reload server module to pick up env change
      delete require.cache[require.resolve('./server.js')];
      const { startServer } = require('./server.js');
      server = await startServer();
      const port = server.address().port;
      app = request(`http://localhost:${port}`);

      const testFile = createTestAudioFile();

      try {
        const response = await app
          .post('/api/upload-track')
          .attach('audio', testFile, 'test.mp3')
          .expect(200);

        expect(response.body.ok).toBe(true);
        // Should use request origin (localhost or 127.0.0.1)
        expect(response.body.trackUrl).toMatch(/^http:\/\/(?:localhost|127\.0\.0\.1):\d+\/api\/track\//);
        expect(response.body.trackId).toBeDefined();
      } finally {
        cleanupTestFile(testFile);
      }
    }, 10000);

    test('trackUrl should always include /api/track/ path', async () => {
      process.env.PUBLIC_BASE_URL = 'https://test.example.com';
      process.env.PORT = '0';

      delete require.cache[require.resolve('./server.js')];
      const { startServer } = require('./server.js');
      server = await startServer();
      const port = server.address().port;
      app = request(`http://localhost:${port}`);

      const testFile = createTestAudioFile();

      try {
        const response = await app
          .post('/api/upload-track')
          .attach('audio', testFile, 'test.mp3')
          .expect(200);

        expect(response.body.trackUrl).toContain('/api/track/');
        expect(response.body.trackUrl).toMatch(/\/api\/track\/[A-Z0-9]+$/);
      } finally {
        cleanupTestFile(testFile);
        delete process.env.PUBLIC_BASE_URL;
      }
    }, 10000);

    test('should handle PUBLIC_BASE_URL with trailing slash', async () => {
      process.env.PUBLIC_BASE_URL = 'https://test.example.com/'; // Note trailing slash
      process.env.PORT = '0';

      delete require.cache[require.resolve('./server.js')];
      const { startServer } = require('./server.js');
      server = await startServer();
      const port = server.address().port;
      app = request(`http://localhost:${port}`);

      const testFile = createTestAudioFile();

      try {
        const response = await app
          .post('/api/upload-track')
          .attach('audio', testFile, 'test.mp3')
          .expect(200);

        // Should not have double slash after normalizing
        expect(response.body.trackUrl).not.toContain('//api/track/');
        expect(response.body.trackUrl).toMatch(/^https:\/\/test\.example\.com\/api\/track\//);
      } finally {
        cleanupTestFile(testFile);
        delete process.env.PUBLIC_BASE_URL;
      }
    }, 10000);
  });
});
