/**
 * PWA Readiness Test Suite
 * Tests compliance with Progressive Web App requirements
 */

const fs = require('fs');
const path = require('path');

describe('PWA Readiness Audit', () => {
  let manifest;
  let serviceWorker;
  let indexHtml;

  beforeAll(() => {
    // Load manifest.json
    const manifestPath = path.join(__dirname, 'manifest.json');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Load service worker
    const swPath = path.join(__dirname, 'service-worker.js');
    serviceWorker = fs.readFileSync(swPath, 'utf8');

    // Load index.html
    const indexPath = path.join(__dirname, 'index.html');
    indexHtml = fs.readFileSync(indexPath, 'utf8');
  });

  describe('Manifest.json Compliance', () => {
    test('has required name field', () => {
      expect(manifest.name).toBeDefined();
      expect(manifest.name.length).toBeGreaterThan(0);
    });

    test('has required short_name field', () => {
      expect(manifest.short_name).toBeDefined();
      expect(manifest.short_name.length).toBeGreaterThan(0);
    });

    test('has start_url field', () => {
      expect(manifest.start_url).toBeDefined();
    });

    test('has display mode set to standalone or fullscreen', () => {
      expect(['standalone', 'fullscreen']).toContain(manifest.display);
    });

    test('has at least one icon >= 192x192', () => {
      const largeIcons = manifest.icons.filter(icon => {
        const size = parseInt(icon.sizes.split('x')[0]);
        return size >= 192;
      });
      expect(largeIcons.length).toBeGreaterThan(0);
    });

    test('has at least one icon >= 512x512', () => {
      const extraLargeIcons = manifest.icons.filter(icon => {
        const size = parseInt(icon.sizes.split('x')[0]);
        return size >= 512;
      });
      expect(extraLargeIcons.length).toBeGreaterThan(0);
    });

    test('has theme_color defined', () => {
      expect(manifest.theme_color).toBeDefined();
      expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    test('has background_color defined', () => {
      expect(manifest.background_color).toBeDefined();
      expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    test('has icons with correct purposes', () => {
      const hasMaskable = manifest.icons.some(icon => 
        icon.purpose && icon.purpose.includes('maskable')
      );
      expect(hasMaskable).toBe(true);
    });

    test('all icon files exist', () => {
      manifest.icons.forEach(icon => {
        const iconPath = path.join(__dirname, icon.src);
        expect(fs.existsSync(iconPath)).toBe(true);
      });
    });

    test('has description field', () => {
      expect(manifest.description).toBeDefined();
      expect(manifest.description.length).toBeGreaterThan(0);
    });
  });

  describe('Service Worker Compliance', () => {
    test('service worker file exists', () => {
      const swPath = path.join(__dirname, 'service-worker.js');
      expect(fs.existsSync(swPath)).toBe(true);
    });

    test('has install event listener', () => {
      expect(serviceWorker).toContain("addEventListener('install'");
    });

    test('has activate event listener', () => {
      expect(serviceWorker).toContain("addEventListener('activate'");
    });

    test('has fetch event listener', () => {
      expect(serviceWorker).toContain("addEventListener('fetch'");
    });

    test('implements caching strategy', () => {
      expect(serviceWorker).toContain('caches.open');
    });

    test('has cache name defined', () => {
      expect(serviceWorker).toMatch(/CACHE_NAME\s*=\s*['"`]/);
    });

    test('precaches essential assets', () => {
      expect(serviceWorker).toContain('PRECACHE_ASSETS');
      expect(serviceWorker).toContain('cache.addAll');
    });

    test('implements skipWaiting for updates', () => {
      expect(serviceWorker).toContain('skipWaiting');
    });

    test('implements clients.claim for activation', () => {
      expect(serviceWorker).toContain('clients.claim');
    });
  });

  describe('HTML Meta Tags and Links', () => {
    test('links to manifest.json', () => {
      expect(indexHtml).toContain('rel="manifest"');
      expect(indexHtml).toContain('manifest.json');
    });

    test('has theme-color meta tag', () => {
      expect(indexHtml).toContain('name="theme-color"');
    });

    test('has viewport meta tag', () => {
      expect(indexHtml).toContain('name="viewport"');
    });

    test('registers service worker', () => {
      expect(indexHtml).toContain('serviceWorker');
      expect(indexHtml).toContain('register');
    });

    test('has apple-touch-icon for iOS', () => {
      expect(indexHtml).toContain('apple-touch-icon');
    });

    test('has meta description for SEO', () => {
      expect(indexHtml).toContain('name="description"');
    });
  });

  describe('Installability Criteria', () => {
    test('manifest has required fields for installation', () => {
      const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
      requiredFields.forEach(field => {
        expect(manifest[field]).toBeDefined();
      });
    });

    test('has at least 2 icons for different sizes', () => {
      expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
    });

    test('manifest scope is defined', () => {
      expect(manifest.scope).toBeDefined();
    });
  });

  describe('Offline Functionality', () => {
    test('service worker caches app shell', () => {
      expect(serviceWorker).toContain('index.html');
      expect(serviceWorker).toContain('styles.css');
      expect(serviceWorker).toContain('app.js');
    });

    test('has fallback strategy for offline', () => {
      expect(serviceWorker).toContain('caches.match');
    });

    test('handles network errors gracefully', () => {
      expect(serviceWorker).toContain('.catch');
    });
  });

  describe('Best Practices', () => {
    test('manifest has language specified', () => {
      expect(manifest.lang).toBeDefined();
    });

    test('manifest has text direction specified', () => {
      expect(manifest.dir).toBeDefined();
    });

    test('manifest has categories for app classification', () => {
      expect(manifest.categories).toBeDefined();
      expect(Array.isArray(manifest.categories)).toBe(true);
    });

    test('service worker version is managed', () => {
      expect(serviceWorker).toMatch(/v\d+\.\d+\.\d+/);
    });
  });
});
