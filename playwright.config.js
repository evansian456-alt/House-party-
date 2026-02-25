// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e-tests',
  
  /* Run tests in files in parallel */
  fullyParallel: false, // We need sequential execution for multi-user tests
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: 1, // Sequential execution for multi-session tests

  /* Per-test timeout: 60 s per test. Prevents single hung tests from blocking the suite. */
  timeout: 60_000,

  /* Global timeout: 25 minutes — gives all tests time to complete and still leaves
   * 5 minutes for the GitHub Actions job to upload artifacts before the 30 m job limit. */
  globalTimeout: 25 * 60 * 1000,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['list']
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable permissions for clipboard access
        permissions: ['clipboard-read', 'clipboard-write']
      },
    },
    {
      name: 'android-chrome',
      use: {
        ...devices['Pixel 5'],
        // Android-specific settings
        permissions: ['clipboard-read', 'clipboard-write'],
        userAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
      },
    },
    {
      name: 'android-tablet',
      use: {
        ...devices['Galaxy Tab S4'],
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
  ],

  /*
   * NOTE: Server lifecycle is managed by scripts/e2e-runner.js.
   * When running via `npm run test:e2e` the runner starts the server on a free
   * port and passes BASE_URL into this process.  If you invoke `npx playwright
   * test` directly you must start the server yourself and set BASE_URL.
   */
});
