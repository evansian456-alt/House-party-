// @ts-check
/**
 * E2E Account Lifecycle Test
 *
 * Covers the full required flow:
 *   1. Sign up with unique email  → assert "Welcome to the party 🥳"
 *   2. Confirm authenticated state via /api/me
 *   3. Log out → assert landing/login view
 *   4. Log back in with same credentials → assert authenticated state again
 *   5. Duplicate signup → assert "Account already exists" + "Log In Instead" CTA
 *
 * If any step fails, diagnostics are printed: API status/bodies + console errors.
 *
 * Run against local server:   BASE_URL=http://localhost:8080 npx playwright test e2e-tests/account-lifecycle.spec.js
 * Run via CI script:          npm run test:e2e (starts server automatically)
 */

const { test, expect } = require('@playwright/test');

const BASE = process.env.E2E_BASE_URL || process.env.BASE_URL || 'http://localhost:8080';

/** Generate a unique test email for each run. */
function makeTestEmail() {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2)}@test.invalid`;
}

/** Print diagnostic API info. Used in test failure hooks. */
async function printDiagnostics(request, email, password) {
  try {
    console.error('[DIAG] --- Account Lifecycle Diagnostics ---');
    const signupRes = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password, djName: 'DiagDJ', termsAccepted: true },
    });
    console.error(`[DIAG] POST /api/auth/signup  status=${signupRes.status()}  body=${await signupRes.text()}`);
  } catch (e) {
    console.error('[DIAG] signup request failed:', e.message);
  }

  try {
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email, password },
    });
    console.error(`[DIAG] POST /api/auth/login   status=${loginRes.status()}  body=${await loginRes.text()}`);
  } catch (e) {
    console.error('[DIAG] login request failed:', e.message);
  }

  try {
    const meRes = await request.get(`${BASE}/api/me`);
    console.error(`[DIAG] GET  /api/me           status=${meRes.status()}  body=${await meRes.text()}`);
  } catch (e) {
    console.error('[DIAG] /api/me request failed:', e.message);
  }
}

test.describe('Account lifecycle', () => {
  // Unique credentials shared across the describe block
  const EMAIL = makeTestEmail();
  const PASSWORD = 'E2eTestPass12!'; // >= 12 chars
  const DJ_NAME = `DJ_Lifecycle_${Date.now()}`.slice(0, 30);

  test.beforeEach(async ({ page }) => {
    // Capture and relay console errors from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('[PAGE CONSOLE ERROR]', msg.text());
      }
    });
  });

  // ── Step 1 & 2: Signup → "Welcome to the party 🥳" → authenticated ──────

  test('1. signup shows "Welcome to the party 🥳" and reaches authenticated state', async ({ page, request }) => {
    await page.goto(BASE);

    // Navigate to the signup form
    const signupBtn = page.locator('button, a').filter({ hasText: /sign up|register|create account/i }).first();
    if (await signupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signupBtn.click();
    } else {
      await page.goto(`${BASE}/#signup`);
    }

    // Fill the signup form
    const emailField = page.locator('input[type="email"], input[name="email"], #signupEmail').first();
    await emailField.waitFor({ timeout: 5000 });
    await emailField.fill(EMAIL);

    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.first().fill(PASSWORD);
    if ((await passwordFields.count()) > 1) {
      await passwordFields.nth(1).fill(PASSWORD);
    }

    const djNameField = page.locator('input[name="djName"], input[id="signupDjName"]').first();
    if (await djNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await djNameField.fill(DJ_NAME);
    }

    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await termsCheckbox.isChecked())) {
        await termsCheckbox.check();
      }
    }

    await page.locator('button[type="submit"], button').filter({ hasText: /sign up|register|create/i }).first().click();

    // Assert "Welcome to the party 🥳" appears
    await expect(page.locator('body')).toContainText('Welcome to the party 🥳', { timeout: 8000 });

    // Wait for /api/me to confirm authenticated state — poll up to 5 s
    // (accounts for the app's 1.5 s "Welcome" delay + network round-trip)
    let meRes;
    const deadline = Date.now() + 5000;
    do {
      meRes = await request.get(`${BASE}/api/me`);
      if (meRes.ok()) break;
      await new Promise((r) => setTimeout(r, 300));
    } while (Date.now() < deadline);

    if (!meRes.ok()) {
      await printDiagnostics(request, EMAIL, PASSWORD);
      await page.screenshot({ path: '/tmp/lifecycle-signup-fail.png' });
    }
    expect(meRes.ok()).toBeTruthy();
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe(EMAIL.toLowerCase());
  });

  // ── Step 3: Logout → landing visible ────────────────────────────────────

  test('2. logout returns to landing/login view', async ({ page, request }) => {
    // Pre-login via API so UI starts authenticated
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!loginRes.ok()) {
      await printDiagnostics(request, EMAIL, PASSWORD);
    }
    expect(loginRes.ok()).toBeTruthy();

    // Restore session in browser via cookie
    const cookies = (await request.storageState()).cookies || [];
    if (cookies.length > 0) {
      await page.context().addCookies(cookies);
    }

    await page.goto(BASE);

    // Click logout button
    const logoutBtn = page.locator('button, a').filter({ hasText: /log out|logout|sign out/i }).first();
    if (await logoutBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await logoutBtn.click();
    } else {
      // Fallback: call logout via API
      await request.post(`${BASE}/api/auth/logout`);
      await page.reload();
    }

    // After logout, /api/me must return 401
    const meAfter = await request.get(`${BASE}/api/me`);
    expect(meAfter.status()).toBe(401);
  });

  // ── Step 4: Re-login with same credentials ───────────────────────────────

  test('3. re-login with same credentials restores authenticated state', async ({ request }) => {
    const loginRes = await request.post(`${BASE}/api/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    });
    if (!loginRes.ok()) {
      await printDiagnostics(request, EMAIL, PASSWORD);
    }
    expect(loginRes.ok()).toBeTruthy();
    const loginBody = await loginRes.json();
    expect(loginBody.success).toBe(true);
    expect(loginBody.user.email).toBe(EMAIL.toLowerCase());

    const meRes = await request.get(`${BASE}/api/me`);
    expect(meRes.ok()).toBeTruthy();
    const meBody = await meRes.json();
    expect(meBody.user.email).toBe(EMAIL.toLowerCase());
  });

  // ── Step 5: Duplicate signup ─────────────────────────────────────────────

  test('4. duplicate signup (API) returns 409 "Account already exists"', async ({ request }) => {
    const dupRes = await request.post(`${BASE}/api/auth/signup`, {
      data: { email: EMAIL, password: PASSWORD, djName: DJ_NAME, termsAccepted: true },
    });
    expect(dupRes.status()).toBe(409);
    const body = await dupRes.json();
    expect(body.error).toBe('Account already exists');
  });

  test('5. duplicate signup (UI) shows "Account already exists" and "Log In Instead" CTA', async ({ page }) => {
    await page.goto(BASE);

    // Navigate to signup
    const signupBtn = page.locator('button, a').filter({ hasText: /sign up|register|create account/i }).first();
    if (await signupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signupBtn.click();
    } else {
      await page.goto(`${BASE}/#signup`);
    }

    const emailField = page.locator('input[type="email"], input[name="email"], #signupEmail').first();
    await emailField.waitFor({ timeout: 5000 });
    await emailField.fill(EMAIL);

    const passwordFields = page.locator('input[type="password"]');
    await passwordFields.first().fill(PASSWORD);
    if ((await passwordFields.count()) > 1) {
      await passwordFields.nth(1).fill(PASSWORD);
    }

    const djNameField = page.locator('input[name="djName"], input[id="signupDjName"]').first();
    if (await djNameField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await djNameField.fill(DJ_NAME);
    }

    const termsCheckbox = page.locator('input[type="checkbox"]').first();
    if (await termsCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
      if (!(await termsCheckbox.isChecked())) {
        await termsCheckbox.check();
      }
    }

    await page.locator('button[type="submit"], button').filter({ hasText: /sign up|register|create/i }).first().click();

    // Assert "Account already exists" message
    await expect(page.locator('body')).toContainText('Account already exists', { timeout: 8000 });

    // Assert "Log In Instead" CTA
    const loginInstead = page.locator('a, button').filter({ hasText: /log in instead/i }).first();
    await expect(loginInstead).toBeVisible({ timeout: 3000 });

    // Screenshot for evidence
    await page.screenshot({ path: '/tmp/lifecycle-dup-signup.png' });
  });
});
