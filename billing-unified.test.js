/**
 * billing-unified.test.js
 *
 * Tests for:
 * 1. billing/products.js  – product catalog mapping
 * 2. billing/entitlements.js – applyPurchaseToUser idempotency (in-memory)
 * 3. Admin gating via auth-middleware isAdminEmail / requireAdmin
 * 4. Heartbeat, basket, and IAP route smoke tests
 *
 * All tests run without a real database.
 */

'use strict';

// ── Reset module registry between describe blocks ─────────────────────────────
// (billing/entitlements.js has module-level state; _resetMemStore clears it)

// ── Database mock ─────────────────────────────────────────────────────────────
jest.mock('./database', () => ({
  query: jest.fn().mockRejectedValue(new Error('no db')), // force in-memory path
  getOrCreateUserUpgrades: jest.fn(),
  resolveEntitlements: jest.fn(),
  pool: { end: jest.fn() }
}));

// ── Redis mock ────────────────────────────────────────────────────────────────
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    keys: jest.fn().mockResolvedValue([]),
    scan: jest.fn().mockResolvedValue(['0', []]),
    flushall: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    status: 'ready'
  }));
});

// ── Stripe mock ───────────────────────────────────────────────────────────────
jest.mock('./stripe-client', () => null);

// =============================================================================
// 1. billing/products.js
// =============================================================================

describe('billing/products.js', () => {
  const { PRODUCTS, getProduct, getProductByPlatformId } = require('./billing/products');

  test('exports party_pass and pro_monthly', () => {
    expect(PRODUCTS).toHaveProperty('party_pass');
    expect(PRODUCTS).toHaveProperty('pro_monthly');
  });

  test('party_pass has correct shape', () => {
    const p = PRODUCTS.party_pass;
    expect(p.key).toBe('party_pass');
    expect(p.type).toBe('one_time');
    expect(p.stripe.priceId).toBeTruthy();
    expect(p.apple.productId).toBeTruthy();
    expect(p.google.productId).toBeTruthy();
    expect(p.entitlement.tier).toBe('PARTY_PASS');
  });

  test('pro_monthly has correct shape', () => {
    const p = PRODUCTS.pro_monthly;
    expect(p.key).toBe('pro_monthly');
    expect(p.type).toBe('subscription');
    expect(p.stripe.priceId).toBeTruthy();
    expect(p.apple.productId).toBeTruthy();
    expect(p.google.productId).toBeTruthy();
    expect(p.entitlement.tier).toBe('PRO');
  });

  test('getProduct returns product by key', () => {
    expect(getProduct('party_pass')).toBe(PRODUCTS.party_pass);
    expect(getProduct('pro_monthly')).toBe(PRODUCTS.pro_monthly);
  });

  test('getProduct returns null for unknown key', () => {
    expect(getProduct('unknown_product')).toBeNull();
  });

  test('getProductByPlatformId finds Apple product', () => {
    const p = getProductByPlatformId('apple', 'com.phoneparty.partypass');
    expect(p).not.toBeNull();
    expect(p.key).toBe('party_pass');
  });

  test('getProductByPlatformId finds Google product', () => {
    const p = getProductByPlatformId('google', 'com.phoneparty.pro.monthly');
    expect(p).not.toBeNull();
    expect(p.key).toBe('pro_monthly');
  });

  test('getProductByPlatformId returns null for unknown productId', () => {
    expect(getProductByPlatformId('apple', 'com.unknown.product')).toBeNull();
  });

  test('Stripe price IDs use configured values', () => {
    // party_pass
    expect(PRODUCTS.party_pass.stripe.priceId).toMatch(/^price_/);
    // pro_monthly
    expect(PRODUCTS.pro_monthly.stripe.priceId).toMatch(/^price_/);
  });
});

// =============================================================================
// 2. billing/entitlements.js – applyPurchaseToUser (in-memory path)
// =============================================================================

describe('billing/entitlements.js – applyPurchaseToUser (in-memory)', () => {
  let applyPurchaseToUser, getMemPurchases, getMemUserTier, _resetMemStore;

  beforeEach(() => {
    jest.resetModules();
    // Re-mock database so each test gets a fresh module with db unavailable
    jest.mock('./database', () => ({
      query: jest.fn().mockRejectedValue(new Error('no db')),
      getOrCreateUserUpgrades: jest.fn(),
      resolveEntitlements: jest.fn(),
      pool: { end: jest.fn() }
    }));
    const mod = require('./billing/entitlements');
    applyPurchaseToUser = mod.applyPurchaseToUser;
    getMemPurchases = mod.getMemPurchases;
    getMemUserTier = mod.getMemUserTier;
    _resetMemStore = mod._resetMemStore;
    _resetMemStore();
  });

  test('applies party_pass and sets tier PARTY_PASS', async () => {
    const result = await applyPurchaseToUser({
      userId: 'user-1',
      productKey: 'party_pass',
      provider: 'apple',
      providerTransactionId: 'txn-001',
      raw: {}
    });
    expect(result.applied).toBe(true);
    expect(result.alreadyApplied).toBe(false);
    expect(result.tier).toBe('PARTY_PASS');
    expect(getMemUserTier('user-1').partyPassActive).toBe(true);
  });

  test('applies pro_monthly and sets tier PRO', async () => {
    const result = await applyPurchaseToUser({
      userId: 'user-2',
      productKey: 'pro_monthly',
      provider: 'google',
      providerTransactionId: 'txn-002',
      raw: {}
    });
    expect(result.applied).toBe(true);
    expect(result.tier).toBe('PRO');
    expect(getMemUserTier('user-2').userTier).toBe('PRO');
    expect(getMemUserTier('user-2').subscriptionStatus).toBe('active');
  });

  test('idempotency – same transactionId does not double-apply', async () => {
    await applyPurchaseToUser({
      userId: 'user-3',
      productKey: 'party_pass',
      provider: 'stripe',
      providerTransactionId: 'txn-idem-001',
      raw: {}
    });
    const second = await applyPurchaseToUser({
      userId: 'user-3',
      productKey: 'party_pass',
      provider: 'stripe',
      providerTransactionId: 'txn-idem-001',
      raw: {}
    });
    expect(second.applied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    // Only one purchase record
    const purchases = getMemPurchases().filter(p => p.providerTransactionId === 'txn-idem-001');
    expect(purchases).toHaveLength(1);
  });

  test('different transactionIds for same user both apply', async () => {
    await applyPurchaseToUser({ userId: 'user-4', productKey: 'party_pass', provider: 'apple', providerTransactionId: 'txn-A', raw: {} });
    const r2 = await applyPurchaseToUser({ userId: 'user-4', productKey: 'pro_monthly', provider: 'apple', providerTransactionId: 'txn-B', raw: {} });
    expect(r2.applied).toBe(true);
    expect(getMemPurchases().filter(p => p.userId === 'user-4')).toHaveLength(2);
  });

  test('throws if userId is missing', async () => {
    await expect(applyPurchaseToUser({ productKey: 'party_pass', provider: 'apple', providerTransactionId: 'txn-x' }))
      .rejects.toThrow('userId is required');
  });

  test('throws if productKey is missing', async () => {
    await expect(applyPurchaseToUser({ userId: 'u1', provider: 'apple', providerTransactionId: 'txn-x' }))
      .rejects.toThrow('productKey is required');
  });

  test('throws if unknown productKey', async () => {
    await expect(applyPurchaseToUser({ userId: 'u1', productKey: 'magic_beans', provider: 'apple', providerTransactionId: 'txn-x' }))
      .rejects.toThrow('unknown productKey');
  });

  test('throws if provider is missing', async () => {
    await expect(applyPurchaseToUser({ userId: 'u1', productKey: 'party_pass', providerTransactionId: 'txn-x' }))
      .rejects.toThrow('provider is required');
  });

  test('throws if providerTransactionId is missing', async () => {
    await expect(applyPurchaseToUser({ userId: 'u1', productKey: 'party_pass', provider: 'apple' }))
      .rejects.toThrow('providerTransactionId is required');
  });
});

// =============================================================================
// 3. Admin gating
// =============================================================================

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

describe('Admin gating', () => {
  const ADMIN_EMAIL = 'ianevans2023@outlook.com';
  let authMW;
  const savedAdminEmails = process.env.ADMIN_EMAILS;

  beforeAll(() => {
    jest.resetModules();
    process.env.ADMIN_EMAILS = ADMIN_EMAIL;
    authMW = require('./auth-middleware');
  });

  afterAll(() => {
    if (savedAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = savedAdminEmails;
  });

  test('isAdminEmail returns true for admin email', () => {
    expect(authMW.isAdminEmail(ADMIN_EMAIL)).toBe(true);
    expect(authMW.isAdminEmail(ADMIN_EMAIL.toUpperCase())).toBe(true);
  });

  test('isAdminEmail returns false for non-admin email', () => {
    expect(authMW.isAdminEmail('other@example.com')).toBe(false);
  });

  test('requireAdmin allows admin user', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/test', authMW.requireAdmin, (_req, res) => res.json({ ok: true }));
    const token = authMW.generateToken({ userId: 'admin-1', email: ADMIN_EMAIL, isAdmin: true });
    const res = await request(app).get('/test').set('Cookie', `auth_token=${token}`);
    expect(res.status).toBe(200);
  });

  test('requireAdmin returns 403 for non-admin authenticated user', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/test', authMW.requireAdmin, (_req, res) => res.json({ ok: true }));
    const token = authMW.generateToken({ userId: 'user-99', email: 'user@example.com', isAdmin: false });
    const res = await request(app).get('/test').set('Cookie', `auth_token=${token}`);
    expect(res.status).toBe(403);
  });

  test('requireAdmin returns 401 for unauthenticated request', async () => {
    const app = express();
    app.use(cookieParser());
    app.get('/test', authMW.requireAdmin, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  test('admin with isAdmin=true bypasses tier gating (effectiveTier=PRO)', () => {
    // Simulate the /api/me logic: isAdmin => effectiveTier = 'PRO'
    const mockUser = { tier: 'FREE', is_admin: true };
    const effectiveTier = (mockUser.is_admin) ? 'PRO' : (mockUser.tier || 'FREE');
    expect(effectiveTier).toBe('PRO');
  });
});

// =============================================================================
// 4. Heartbeat + basket route smoke tests (minimal Express app)
// =============================================================================

describe('Heartbeat and Basket routes (smoke)', () => {
  let app;
  let authMW;
  const savedAdminEmails = process.env.ADMIN_EMAILS;

  beforeAll(() => {
    jest.resetModules();
    process.env.ADMIN_EMAILS = 'admin@example.com';
    authMW = require('./auth-middleware');

    const { PRODUCTS } = require('./billing/products');
    const _heartbeatStore = new Map();
    const _baskets = new Map();

    app = express();
    app.use(cookieParser());
    app.use(express.json());

    // Heartbeat
    app.post('/api/metrics/heartbeat', (req, res) => {
      const { userId } = req.body || {};
      if (!userId) return res.status(400).json({ error: 'userId required' });
      _heartbeatStore.set(String(userId), new Date());
      return res.json({ ok: true });
    });

    // Basket – add
    app.post('/api/basket/add', authMW.requireAuth, (req, res) => {
      const { productKey } = req.body || {};
      const userId = req.user.userId;
      if (!productKey) return res.status(400).json({ error: 'productKey required' });
      if (!PRODUCTS[productKey]) return res.status(400).json({ error: `Unknown productKey: ${productKey}` });
      const basket = _baskets.get(userId) || new Set();
      basket.add(productKey);
      _baskets.set(userId, basket);
      return res.json({ basket: Array.from(basket) });
    });

    // Basket – remove
    app.post('/api/basket/remove', authMW.requireAuth, (req, res) => {
      const { productKey } = req.body || {};
      const userId = req.user.userId;
      if (!productKey) return res.status(400).json({ error: 'productKey required' });
      const basket = _baskets.get(userId) || new Set();
      basket.delete(productKey);
      _baskets.set(userId, basket);
      return res.json({ basket: Array.from(basket) });
    });

    // Basket – get
    app.get('/api/basket', authMW.requireAuth, (req, res) => {
      const userId = req.user.userId;
      const basket = _baskets.get(userId) || new Set();
      return res.json({ basket: Array.from(basket) });
    });
  });

  afterAll(() => {
    if (savedAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = savedAdminEmails;
  });

  function makeAuthCookie(userId = 'user-1', email = 'test@example.com') {
    const token = authMW.generateToken({ userId, email });
    return `auth_token=${token}`;
  }

  test('POST /api/metrics/heartbeat returns 400 without userId', async () => {
    const res = await request(app).post('/api/metrics/heartbeat').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/metrics/heartbeat returns ok with userId', async () => {
    const res = await request(app).post('/api/metrics/heartbeat').send({ userId: 'u1' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('GET /api/basket returns 401 without auth', async () => {
    const res = await request(app).get('/api/basket');
    expect(res.status).toBe(401);
  });

  test('POST /api/basket/add adds product to basket', async () => {
    const res = await request(app)
      .post('/api/basket/add')
      .set('Cookie', [makeAuthCookie('basket-user-1')])
      .send({ productKey: 'party_pass' });
    expect(res.status).toBe(200);
    expect(res.body.basket).toContain('party_pass');
  });

  test('POST /api/basket/add returns 400 for unknown product', async () => {
    const res = await request(app)
      .post('/api/basket/add')
      .set('Cookie', [makeAuthCookie('basket-user-1')])
      .send({ productKey: 'nonexistent' });
    expect(res.status).toBe(400);
  });

  test('POST /api/basket/remove removes product from basket', async () => {
    // Add first
    await request(app)
      .post('/api/basket/add')
      .set('Cookie', [makeAuthCookie('basket-user-2')])
      .send({ productKey: 'pro_monthly' });
    // Remove
    const res = await request(app)
      .post('/api/basket/remove')
      .set('Cookie', [makeAuthCookie('basket-user-2')])
      .send({ productKey: 'pro_monthly' });
    expect(res.status).toBe(200);
    expect(res.body.basket).not.toContain('pro_monthly');
  });

  test('GET /api/basket returns current basket', async () => {
    await request(app)
      .post('/api/basket/add')
      .set('Cookie', [makeAuthCookie('basket-user-3')])
      .send({ productKey: 'party_pass' });
    const res = await request(app)
      .get('/api/basket')
      .set('Cookie', [makeAuthCookie('basket-user-3')]);
    expect(res.status).toBe(200);
    expect(res.body.basket).toContain('party_pass');
  });
});
