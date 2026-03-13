/**
 * Copyright Reporting System Tests
 *
 * Tests for:
 * 1. POST /api/report-copyright — validation and insertion
 * 2. GET /admin/copyright-reports — admin list endpoint
 * 3. PATCH /admin/copyright-reports/:id — admin action endpoint
 */

'use strict';

const request = require('supertest');

// ── Database mock ─────────────────────────────────────────────────────────────
const mockDbQuery = jest.fn();
const mockGetOrCreateUserUpgrades = jest.fn().mockResolvedValue({
  party_pass_expires_at: null,
  pro_monthly_active: false,
  pro_monthly_started_at: null,
  pro_monthly_renewal_provider: null
});
const mockResolveEntitlements = jest.fn().mockReturnValue({ hasPartyPass: false, hasPro: false });

jest.mock('./database', () => ({
  query: mockDbQuery,
  getOrCreateUserUpgrades: mockGetOrCreateUserUpgrades,
  resolveEntitlements: mockResolveEntitlements,
  pool: { end: jest.fn() }
}));

// ── Redis mock ─────────────────────────────────────────────────────────────────
jest.mock('ioredis', () => {
  const Redis = jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    scan: jest.fn().mockResolvedValue(['0', []]),
    flushall: jest.fn().mockResolvedValue('OK'),
    on: jest.fn(),
    status: 'ready'
  }));
  return Redis;
});

// ── Stripe mock ───────────────────────────────────────────────────────────────
jest.mock('./stripe-client', () => null);

describe('Copyright Reporting System', () => {
  let app;
  let authMiddleware;

  beforeAll(() => {
    jest.resetModules();
    process.env.ADMIN_EMAILS = 'admin@test.com';
    ({ app } = require('./server'));
    authMiddleware = require('./auth-middleware');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Creates a signed JWT token cookie header for test authentication.
   */
  function makeAuthCookie(isAdmin = false, email = 'user@test.com') {
    const token = authMiddleware.generateToken({ userId: 1, email, djName: 'TestDJ', isAdmin });
    return `auth_token=${token}`;
  }

  // ── POST /api/report-copyright ─────────────────────────────────────────────
  describe('POST /api/report-copyright', () => {
    const validBody = {
      trackId: 'track-abc123',
      partyId: 'PARTY1',
      reason: 'copyright_infringement',
      description: 'This is a copyrighted song.',
      timestamp: new Date().toISOString()
    };

    it('should return 201 with reportId on valid request', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 42, created_at: new Date() }] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ cnt: '1' }] }); // COUNT check

      const res = await request(app)
        .post('/api/report-copyright')
        .send(validBody)
        .expect(201);

      expect(res.body.ok).toBe(true);
      expect(res.body.reportId).toBe(42);
      expect(res.body.message).toMatch(/submitted/i);
    });

    it('should return 400 when trackId is missing', async () => {
      const res = await request(app)
        .post('/api/report-copyright')
        .send({ ...validBody, trackId: '' })
        .expect(400);

      expect(res.body.error).toMatch(/trackId/i);
    });

    it('should return 400 when partyId is missing', async () => {
      const res = await request(app)
        .post('/api/report-copyright')
        .send({ ...validBody, partyId: '' })
        .expect(400);

      expect(res.body.error).toMatch(/partyId/i);
    });

    it('should return 400 for invalid reason', async () => {
      const res = await request(app)
        .post('/api/report-copyright')
        .send({ ...validBody, reason: 'spam' })
        .expect(400);

      expect(res.body.error).toMatch(/reason/i);
    });

    it('should accept all valid reason values', async () => {
      const reasons = ['copyright_infringement', 'unauthorized_upload', 'other'];

      for (const reason of reasons) {
        jest.clearAllMocks();
        mockDbQuery
          .mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }] })
          .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

        const res = await request(app)
          .post('/api/report-copyright')
          .send({ ...validBody, reason })
          .expect(201);

        expect(res.body.ok).toBe(true);
      }
    });

    it('should work without authentication (optionalAuth)', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 5, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

      const res = await request(app)
        .post('/api/report-copyright')
        .send(validBody)
        .expect(201);

      expect(res.body.ok).toBe(true);
    });

    it('should work with authenticated user', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 6, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

      const res = await request(app)
        .post('/api/report-copyright')
        .set('Cookie', makeAuthCookie(false))
        .send(validBody)
        .expect(201);

      expect(res.body.ok).toBe(true);
    });

    it('should return 500 if database insert fails', async () => {
      mockDbQuery.mockRejectedValueOnce(new Error('DB connection lost'));

      const res = await request(app)
        .post('/api/report-copyright')
        .send(validBody)
        .expect(500);

      expect(res.body.error).toBeDefined();
    });

    it('should truncate description to 500 chars', async () => {
      const longDescription = 'x'.repeat(600);
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ id: 7, created_at: new Date() }] })
        .mockResolvedValueOnce({ rows: [{ cnt: '1' }] });

      await request(app)
        .post('/api/report-copyright')
        .send({ ...validBody, description: longDescription })
        .expect(201);

      // Verify the INSERT was called with description sliced to 500
      const insertCall = mockDbQuery.mock.calls[0];
      const insertedDescription = insertCall[1][4]; // 5th param: description
      expect(insertedDescription.length).toBe(500);
    });
  });

  // ── GET /admin/copyright-reports ──────────────────────────────────────────
  describe('GET /admin/copyright-reports', () => {
    const mockReports = [
      {
        id: 1,
        track_id: 'track-abc',
        party_id: 'PARTY1',
        reporter_user_id: 2,
        reason: 'copyright_infringement',
        description: null,
        created_at: new Date(),
        status: 'pending',
        reporter_email: 'reporter@test.com',
        reporter_name: 'Reporter'
      }
    ];

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/admin/copyright-reports')
        .expect(401);
    });

    it('should return 403 for non-admin user', async () => {
      const res = await request(app)
        .get('/admin/copyright-reports')
        .set('Cookie', makeAuthCookie(false))
        .expect(403);

      expect(res.body.error).toMatch(/admin/i);
    });

    it('should return report list for admin user', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: '1' }] }) // COUNT
        .mockResolvedValueOnce({ rows: mockReports }); // SELECT

      const res = await request(app)
        .get('/admin/copyright-reports')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(Array.isArray(res.body.reports)).toBe(true);
      expect(res.body.reports).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(1);
    });

    it('should support status filter query param', async () => {
      mockDbQuery
        .mockResolvedValueOnce({ rows: [{ total: '0' }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await request(app)
        .get('/admin/copyright-reports?status=pending')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .expect(200);

      expect(res.body.ok).toBe(true);
      // Verify the query included the status filter
      const countCall = mockDbQuery.mock.calls[0];
      expect(countCall[1]).toContain('pending');
    });

    it('should return 400 for invalid status filter', async () => {
      const res = await request(app)
        .get('/admin/copyright-reports?status=invalid')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .expect(400);

      expect(res.body.error).toMatch(/Invalid status/i);
    });
  });

  // ── PATCH /admin/copyright-reports/:id ────────────────────────────────────
  describe('PATCH /admin/copyright-reports/:id', () => {
    it('should return 401 without authentication', async () => {
      await request(app)
        .patch('/admin/copyright-reports/1')
        .send({ action: 'reviewed' })
        .expect(401);
    });

    it('should return 403 for non-admin user', async () => {
      const res = await request(app)
        .patch('/admin/copyright-reports/1')
        .set('Cookie', makeAuthCookie(false))
        .send({ action: 'reviewed' })
        .expect(403);

      expect(res.body.error).toMatch(/admin/i);
    });

    it('should update report status for admin', async () => {
      mockDbQuery.mockResolvedValueOnce({
        rows: [{ id: 1, track_id: 'track-abc', party_id: 'PARTY1' }]
      });

      const res = await request(app)
        .patch('/admin/copyright-reports/1')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .send({ action: 'reviewed' })
        .expect(200);

      expect(res.body.ok).toBe(true);
      expect(res.body.action).toBe('reviewed');
    });

    it('should return 400 for invalid action', async () => {
      const res = await request(app)
        .patch('/admin/copyright-reports/1')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .send({ action: 'ban_user' })
        .expect(400);

      expect(res.body.error).toMatch(/action/i);
    });

    it('should return 404 when report does not exist', async () => {
      mockDbQuery.mockResolvedValueOnce({ rows: [] }); // No rows updated

      const res = await request(app)
        .patch('/admin/copyright-reports/9999')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .send({ action: 'dismissed' })
        .expect(404);

      expect(res.body.error).toMatch(/not found/i);
    });

    it('should return 400 for invalid report id', async () => {
      const res = await request(app)
        .patch('/admin/copyright-reports/notanumber')
        .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
        .send({ action: 'reviewed' })
        .expect(400);

      expect(res.body.error).toMatch(/Invalid report id/i);
    });

    it('should accept all valid action values', async () => {
      const actions = ['reviewed', 'removed', 'dismissed'];

      for (const action of actions) {
        jest.clearAllMocks();
        mockDbQuery.mockResolvedValueOnce({
          rows: [{ id: 1, track_id: 'track-abc', party_id: 'PARTY1' }]
        });

        const res = await request(app)
          .patch('/admin/copyright-reports/1')
          .set('Cookie', makeAuthCookie(true, 'admin@test.com'))
          .send({ action })
          .expect(200);

        expect(res.body.ok).toBe(true);
        expect(res.body.action).toBe(action);
      }
    });
  });
});
