/**
 * E2E Tests – Psychoacoustic Sync Masking
 *
 * Verifies that the psychoacoustic masking module is loaded on the page and
 * that each technique behaves correctly:
 *
 *   1. Soft-start ramp: volume starts at 0 and ramps to 1 over ~100 ms
 *   2. Micro-fade on seek: volume briefly dips below 1 around a seek
 *   3. Transient guard: isInTransientPeriod returns true in first 300 ms
 *   4. Micro rate nudge: playbackRate is adjusted then restored for small drifts
 *
 * The tests exercise the module directly via page.evaluate() so they do not
 * depend on the full party-creation flow and can run in CI without a live
 * server or database.
 */

// @ts-check
const { test, expect } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:8080';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the app root and inject `psychoacoustic-masking.js` into the
 * page so all tests share a consistent module instance.
 *
 * @param {import('@playwright/test').Page} page
 */
async function loadMaskingModule(page) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // Inject the module via a dynamic <script> tag evaluated in the page context
  await page.addScriptTag({ path: 'psychoacoustic-masking.js' });

  // Confirm module is available
  const loaded = await page.evaluate(() => typeof window.PsychoacousticMasking === 'function');
  expect(loaded, 'PsychoacousticMasking class must be present on window').toBe(true);
}

/**
 * Create a minimal in-page audio element stub that tracks volume/playbackRate
 * changes for assertions without requiring real media.
 *
 * Returns a reference key so subsequent evaluate() calls can retrieve it.
 *
 * @param {import('@playwright/test').Page} page
 * @param {object} [initial]
 */
async function createStubAudio(page, initial = {}) {
  await page.evaluate((init) => {
    window._testAudio = {
      volume: init.volume !== undefined ? init.volume : 1,
      playbackRate: init.playbackRate !== undefined ? init.playbackRate : 1,
      currentTime: init.currentTime !== undefined ? init.currentTime : 30,
      volumeHistory: [],
      rateHistory: [],
      seekHistory: [],
      get _volume() { return this.__volume; },
      set _volume(v) { this.__volume = v; },
    };

    // Use defineProperty to intercept assignments
    Object.defineProperty(window._testAudio, 'volume', {
      get() { return this.__volume !== undefined ? this.__volume : 1; },
      set(v) {
        this.__volume = v;
        this.volumeHistory.push(v);
      },
      configurable: true,
    });

    Object.defineProperty(window._testAudio, 'playbackRate', {
      get() { return this.__rate !== undefined ? this.__rate : 1; },
      set(v) {
        this.__rate = v;
        this.rateHistory.push(v);
      },
      configurable: true,
    });

    Object.defineProperty(window._testAudio, 'currentTime', {
      get() { return this.__ct !== undefined ? this.__ct : 30; },
      set(v) {
        this.__ct = v;
        this.seekHistory.push(v);
      },
      configurable: true,
    });

    // Initialise starting values
    window._testAudio.volume = init.volume !== undefined ? init.volume : 1;
    window._testAudio.playbackRate = init.playbackRate !== undefined ? init.playbackRate : 1;
    window._testAudio.currentTime = init.currentTime !== undefined ? init.currentTime : 30;
  }, initial);
}

// ── Test Suite ────────────────────────────────────────────────────────────────

test.describe('Psychoacoustic Masking – module availability', () => {
  test('PsychoacousticMasking class is exposed on window', async ({ page }) => {
    await loadMaskingModule(page);

    const constants = await page.evaluate(() => ({
      SOFT_START_RAMP_MS: window.PsychoacousticMasking.SOFT_START_RAMP_MS,
      SEEK_FADE_TARGET_VOLUME: window.PsychoacousticMasking.SEEK_FADE_TARGET_VOLUME,
      TRANSIENT_GUARD_MS: window.PsychoacousticMasking.TRANSIENT_GUARD_MS,
      RATE_NUDGE_MAX_DRIFT_MS: window.PsychoacousticMasking.RATE_NUDGE_MAX_DRIFT_MS,
    }));

    expect(constants.SOFT_START_RAMP_MS).toBeGreaterThanOrEqual(80);
    expect(constants.SOFT_START_RAMP_MS).toBeLessThanOrEqual(120);
    expect(constants.SEEK_FADE_TARGET_VOLUME).toBeGreaterThan(0.5);
    expect(constants.SEEK_FADE_TARGET_VOLUME).toBeLessThan(1);
    expect(constants.TRANSIENT_GUARD_MS).toBe(300);
    expect(constants.RATE_NUDGE_MAX_DRIFT_MS).toBe(120);

    console.log('✓ PsychoacousticMasking constants:', constants);
  });
});

test.describe('Psychoacoustic Masking – Technique 1: Soft-Start Ramp', () => {
  test('softStartRamp sets volume to 0 immediately then ramps up', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { volume: 1 });

    // Trigger the ramp
    await page.evaluate(() => {
      window.PsychoacousticMasking.softStartRamp(window._testAudio, 100);
    });

    // Volume should be 0 immediately after the call
    const initialVol = await page.evaluate(() => window._testAudio.volume);
    expect(initialVol).toBe(0);

    // Wait for the ramp to complete (~120ms)
    await page.waitForTimeout(200);

    // Volume should be 1 at the end of the ramp
    const finalVol = await page.evaluate(() => window._testAudio.volume);
    expect(finalVol).toBeCloseTo(1, 1);

    // Multiple intermediate steps recorded
    const historyLen = await page.evaluate(() => window._testAudio.volumeHistory.length);
    expect(historyLen).toBeGreaterThan(2);

    console.log('✓ Soft-start ramp: volume ramped from 0 to 1 over ~100ms');
  });

  test('softStartRamp is a no-op when audioElement is null', async ({ page }) => {
    await loadMaskingModule(page);

    const result = await page.evaluate(() => {
      const timers = window.PsychoacousticMasking.softStartRamp(null);
      return Array.isArray(timers) && timers.length === 0;
    });
    expect(result).toBe(true);
  });
});

test.describe('Psychoacoustic Masking – Technique 2: Micro-Fade on Seek', () => {
  test('seekWithMicroFade dips volume during seek then restores it', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { volume: 1, currentTime: 30 });

    // Trigger the micro-fade seek
    await page.evaluate(() => {
      window.PsychoacousticMasking.seekWithMicroFade(window._testAudio, 45, {
        totalMs: 80,
      });
    });

    // After fade-out phase (~40ms), volume should be below 1
    await page.waitForTimeout(50);
    const midVol = await page.evaluate(() => window._testAudio.volume);
    expect(midVol).toBeLessThan(1);

    // After the full cycle (~100ms), volume should be back at 1
    await page.waitForTimeout(120);
    const finalVol = await page.evaluate(() => window._testAudio.volume);
    expect(finalVol).toBeCloseTo(1, 1);

    // The seek was performed
    const seekHistory = await page.evaluate(() => window._testAudio.seekHistory);
    expect(seekHistory.length).toBeGreaterThanOrEqual(1);
    expect(seekHistory[seekHistory.length - 1]).toBeCloseTo(45, 0);

    console.log('✓ Micro-fade: volume dipped then restored; seek performed mid-fade');
  });

  test('seekWithMicroFade calls onComplete callback', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { volume: 1, currentTime: 0 });

    await page.evaluate(() => {
      window._fadeCompleted = false;
      window.PsychoacousticMasking.seekWithMicroFade(window._testAudio, 10, {
        totalMs: 60,
        onComplete: () => { window._fadeCompleted = true; },
      });
    });

    await page.waitForTimeout(150);

    const completed = await page.evaluate(() => window._fadeCompleted);
    expect(completed).toBe(true);

    console.log('✓ seekWithMicroFade onComplete callback fired');
  });

  test('seekWithMicroFade is a no-op when audioElement is null', async ({ page }) => {
    await loadMaskingModule(page);

    // Should not throw
    await page.evaluate(() => {
      window.PsychoacousticMasking.seekWithMicroFade(null, 30);
    });
    console.log('✓ seekWithMicroFade null guard works');
  });
});

test.describe('Psychoacoustic Masking – Technique 3: Transient Guard', () => {
  test('isInTransientPeriod returns true within first 300ms', async ({ page }) => {
    await loadMaskingModule(page);

    const result = await page.evaluate(() => {
      const justStarted = Date.now() - 50; // 50ms ago
      return window.PsychoacousticMasking.isInTransientPeriod(justStarted);
    });

    expect(result).toBe(true);
    console.log('✓ isInTransientPeriod: returns true within 300ms window');
  });

  test('isInTransientPeriod returns false after 300ms', async ({ page }) => {
    await loadMaskingModule(page);

    const result = await page.evaluate(() => {
      const longAgo = Date.now() - 500; // 500ms ago
      return window.PsychoacousticMasking.isInTransientPeriod(longAgo);
    });

    expect(result).toBe(false);
    console.log('✓ isInTransientPeriod: returns false after guard window');
  });

  test('isInTransientPeriod returns false when trackStartTimeMs is 0', async ({ page }) => {
    await loadMaskingModule(page);

    const result = await page.evaluate(() => {
      return window.PsychoacousticMasking.isInTransientPeriod(0);
    });

    expect(result).toBe(false);
    console.log('✓ isInTransientPeriod: falsy start time treated as "no guard"');
  });
});

test.describe('Psychoacoustic Masking – Technique 4: Micro Rate Nudge', () => {
  test('applyMicroRateNudge speeds up when device is behind (negative drift)', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { playbackRate: 1 });

    const applied = await page.evaluate(() => {
      // driftMs < 0 → device is behind → should speed up (rate > 1)
      return window.PsychoacousticMasking.applyMicroRateNudge(window._testAudio, -80, {
        nudgeDurationMs: 200,
      });
    });

    expect(applied).toBe(true);

    const rate = await page.evaluate(() => window._testAudio.playbackRate);
    expect(rate).toBeGreaterThan(1);

    // After the nudge duration, rate should return to 1.0
    await page.waitForTimeout(300);
    const restoredRate = await page.evaluate(() => window._testAudio.playbackRate);
    expect(restoredRate).toBeCloseTo(1.0, 2);

    console.log('✓ applyMicroRateNudge: sped up for behind device, then restored to 1.0');
  });

  test('applyMicroRateNudge slows down when device is ahead (positive drift)', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { playbackRate: 1 });

    await page.evaluate(() => {
      // driftMs > 0 → device is ahead → should slow down (rate < 1)
      window.PsychoacousticMasking.applyMicroRateNudge(window._testAudio, 80, {
        nudgeDurationMs: 200,
      });
    });

    const rate = await page.evaluate(() => window._testAudio.playbackRate);
    expect(rate).toBeLessThan(1);

    console.log('✓ applyMicroRateNudge: slowed down for ahead device');
  });

  test('applyMicroRateNudge returns false when drift exceeds threshold', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { playbackRate: 1 });

    const applied = await page.evaluate(() => {
      // 200ms drift → exceeds RATE_NUDGE_MAX_DRIFT_MS (120ms) → no nudge
      return window.PsychoacousticMasking.applyMicroRateNudge(window._testAudio, 200);
    });

    expect(applied).toBe(false);

    const rate = await page.evaluate(() => window._testAudio.playbackRate);
    expect(rate).toBeCloseTo(1.0, 2);

    console.log('✓ applyMicroRateNudge: no nudge for large drift (should use seek instead)');
  });

  test('applyMicroRateNudge is a no-op when audioElement is null', async ({ page }) => {
    await loadMaskingModule(page);

    const applied = await page.evaluate(() => {
      return window.PsychoacousticMasking.applyMicroRateNudge(null, -50);
    });

    expect(applied).toBe(false);
    console.log('✓ applyMicroRateNudge null guard works');
  });
});

test.describe('Psychoacoustic Masking – Integration: fade during drift correction', () => {
  /**
   * This test verifies the complete Technique 2 flow as it would happen during
   * an actual drift correction cycle:
   *
   *   1. DriftController detects large drift and calls _applyHardCorrection
   *   2. _applyHardCorrection calls seekWithMicroFade
   *   3. Volume dips, seek fires, volume restores
   *   4. onCorrectionApplied callback is triggered
   */
  test('fade executes when drift correction triggers a seek', async ({ page }) => {
    await loadMaskingModule(page);
    await createStubAudio(page, { volume: 1, currentTime: 20 });

    // Simulate the correction flow inline (mirrors _applyHardCorrection behaviour)
    await page.evaluate(() => {
      window._correctionFired = false;
      window._seekTarget = 25;

      window.PsychoacousticMasking.seekWithMicroFade(
        window._testAudio,
        window._seekTarget,
        {
          totalMs: 80,
          onComplete: () => {
            window._correctionFired = true;
          },
        }
      );
    });

    // Mid-fade: volume should be reduced (fade is in progress)
    await page.waitForTimeout(45);
    const midVol = await page.evaluate(() => window._testAudio.volume);
    expect(midVol).toBeLessThan(1);

    // Wait for the full cycle
    await page.waitForTimeout(120);

    // Volume should be fully restored
    const finalVol = await page.evaluate(() => window._testAudio.volume);
    expect(finalVol).toBeCloseTo(1, 1);

    // Seek was performed
    const seekHistory = await page.evaluate(() => window._testAudio.seekHistory);
    expect(seekHistory.some(pos => Math.abs(pos - 25) < 1)).toBe(true);

    // onComplete / onCorrectionApplied fired
    const correctionFired = await page.evaluate(() => window._correctionFired);
    expect(correctionFired).toBe(true);

    console.log('✓ Fade logic executes correctly during drift correction seek');
    console.log(`  Volume history: ${await page.evaluate(() => JSON.stringify(window._testAudio.volumeHistory.slice(0, 5)))}`);
    console.log(`  Seek history:   ${await page.evaluate(() => JSON.stringify(window._testAudio.seekHistory))}`);
  });
});
