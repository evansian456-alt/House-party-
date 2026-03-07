/**
 * Safe load test for Phone Party
 *
 * Tests: login, join party, create party, basket add/remove, checkout session creation.
 *
 * Usage (local):
 *   BASE_URL=http://localhost:3000 k6 run tests/load/core-load.k6.js
 *
 * Usage (CI):
 *   BASE_URL=http://localhost:8080 k6 run --duration 30s --vus 5 tests/load/core-load.k6.js
 *
 * Safety:
 * - Never uses live Stripe keys — all Stripe calls are safe because the
 *   server returns 503 when no keys are configured, and we only call the
 *   checkout endpoint (no real charges are made without completing checkout).
 * - Short default duration (30s) and low VU count (5).
 * - All test data uses @test.invalid email addresses that can never be real.
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Options ─────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    core: {
      executor: 'constant-vus',
      vus: __ENV.VUS ? parseInt(__ENV.VUS) : 5,
      duration: __ENV.DURATION || '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],    // < 5% error rate
    http_req_duration: ['p(95)<2000'], // 95th percentile < 2s
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const BASE = __ENV.BASE_URL || 'http://localhost:8080';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${__VU}`;
}

function makeUser() {
  const id = uid();
  return {
    email: `load_${id}@test.invalid`,
    password: 'LoadTest123!',
    djName: `DJ_Load_${id}`.slice(0, 30),
  };
}

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginOk    = new Rate('login_success');
const signupOk   = new Rate('signup_success');
const createOk   = new Rate('create_party_success');
const joinOk     = new Rate('join_party_success');
const basketAddOk = new Rate('basket_add_success');

// ── Main scenario ─────────────────────────────────────────────────────────────
export default function () {
  const user = makeUser();
  let cookies = {};
  let partyCode = null;

  group('signup', () => {
    const res = http.post(
      `${BASE}/api/auth/signup`,
      JSON.stringify({ email: user.email, password: user.password, djName: user.djName }),
      { headers: JSON_HEADERS }
    );
    signupOk.add(res.status === 200 || res.status === 201);
    check(res, { 'signup 200/201': (r) => r.status === 200 || r.status === 201 });
    // Capture auth cookie
    const setCookie = res.headers['Set-Cookie'] || '';
    if (setCookie) cookies['Cookie'] = setCookie.split(';')[0];
  });

  sleep(0.2);

  group('login', () => {
    const res = http.post(
      `${BASE}/api/auth/login`,
      JSON.stringify({ email: user.email, password: user.password }),
      { headers: JSON_HEADERS }
    );
    loginOk.add(res.status === 200);
    check(res, { 'login 200': (r) => r.status === 200 });
    const setCookie = res.headers['Set-Cookie'] || '';
    if (setCookie) cookies['Cookie'] = setCookie.split(';')[0];
  });

  sleep(0.2);

  group('create party', () => {
    const res = http.post(
      `${BASE}/api/create-party`,
      JSON.stringify({ djName: user.djName }),
      { headers: { ...JSON_HEADERS, ...cookies } }
    );
    createOk.add(res.status === 200 || res.status === 201);
    check(res, { 'create party 200': (r) => r.status === 200 || r.status === 201 });
    if (res.status === 200 || res.status === 201) {
      try {
        partyCode = JSON.parse(res.body).code;
      } catch (_) {}
    }
  });

  sleep(0.2);

  group('join party', () => {
    if (!partyCode) return;
    const guestId = `g_${uid()}`;
    const res = http.post(
      `${BASE}/api/join-party`,
      JSON.stringify({ code: partyCode, guestId, djName: `Guest_${uid()}`.slice(0, 30) }),
      { headers: JSON_HEADERS }
    );
    joinOk.add(res.status === 200 || res.status === 201);
    check(res, { 'join party 200': (r) => r.status === 200 || r.status === 201 });
  });

  sleep(0.2);

  group('basket add/remove', () => {
    const priceId = 'price_load_test_dummy';

    // Add
    const addRes = http.post(
      `${BASE}/api/basket/add`,
      JSON.stringify({ priceId }),
      { headers: { ...JSON_HEADERS, ...cookies } }
    );
    basketAddOk.add(addRes.status === 200);
    check(addRes, { 'basket add 200': (r) => r.status === 200 });

    // Remove
    const delRes = http.del(
      `${BASE}/api/basket/item/${encodeURIComponent(priceId)}`,
      null,
      { headers: { ...JSON_HEADERS, ...cookies } }
    );
    check(delRes, { 'basket remove 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  group('checkout session (safe — no live keys)', () => {
    // This is safe: if Stripe is not configured the server returns 503.
    // If Stripe test keys are configured this creates a test session (not a charge).
    const res = http.post(
      `${BASE}/api/create-checkout-session`,
      JSON.stringify({ tier: 'PARTY_PASS' }),
      { headers: { ...JSON_HEADERS, ...cookies } }
    );
    // 200 = success, 400 = bad request, 503 = Stripe not configured — all acceptable
    check(res, { 'checkout session safe': (r) => [200, 201, 400, 503].includes(r.status) });
  });

  sleep(0.3);
}
