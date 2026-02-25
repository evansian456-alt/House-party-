/**
 * Comprehensive tests for all database functions
 * Tests each exported function from database.js
 * 
 * Note: These tests require a running PostgreSQL database.
 * Set DATABASE_URL or DB_* environment variables to connect.
 * Tests will be skipped if database is not available.
 */

const db = require('./database');

// Flag to track if database is available
let dbAvailable = false;

// A nested beforeAll throws (FAIL, not skip) when the database is unavailable,
// satisfying the zero-skip mandate: tests either pass or fail, never skip.
const describeIfDb = (name, fn) => {
  describe(name, () => {
    beforeAll(() => {
      if (!dbAvailable) {
        throw new Error(
          `Database not available — "${name}" tests cannot run. ` +
          'Ensure DATABASE_URL is set and PostgreSQL is running.'
        );
      }
    });
    fn();
  });
};

describe('Database Module', () => {
  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    
    // Check if database is available
    try {
      const healthResult = await db.healthCheck();
      dbAvailable = healthResult.healthy;
      
      if (dbAvailable) {
        // Initialize database schema only if DB is available
        await db.initializeSchema();
        console.log('[Test] Database connected - running integration tests');
      } else {
        console.log('[Test] Database not healthy - skipping integration tests');
      }
    } catch (error) {
      dbAvailable = false;
      console.log('[Test] Database not available - skipping integration tests:', error.message);
    }
  });

  afterAll(async () => {
    // Clean up database connection
    if (dbAvailable) {
      try {
        await db.pool.end();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describeIfDb('Connection and Basic Operations', () => {
    test('query() should execute a simple SELECT query', async () => {
      
      const result = await db.query('SELECT NOW() as current_time');
      
      expect(result).toBeDefined();
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].current_time).toBeDefined();
    });

    test('query() should handle parameterized queries', async () => {
      const result = await db.query('SELECT $1::text as test_value', ['hello']);
      
      expect(result.rows[0].test_value).toBe('hello');
    });

    test('query() should throw error for invalid SQL', async () => {
      await expect(db.query('INVALID SQL SYNTAX')).rejects.toThrow();
    });

    test('getClient() should return a client from the pool', async () => {
      const client = await db.getClient();
      
      expect(client).toBeDefined();
      expect(typeof client.query).toBe('function');
      expect(typeof client.release).toBe('function');
      
      // Release the client back to pool
      client.release();
    });

    test('healthCheck() should return healthy status', async () => {
      const result = await db.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.time).toBeDefined();
    });

    test('initializeSchema() should initialize database tables', async () => {
      const result = await db.initializeSchema();
      
      expect(result).toBe(true);
    });
  });

  describeIfDb('Guest Profile Functions', () => {
    const testGuestId = `test-guest-${Date.now()}-${Math.random()}`;
    
    test('getOrCreateGuestProfile() should create a new guest profile', async () => {
      const profile = await db.getOrCreateGuestProfile(testGuestId, 'Test Guest');
      
      expect(profile).toBeDefined();
      expect(profile.guest_identifier).toBe(testGuestId);
      expect(profile.nickname).toBe('Test Guest');
      expect(profile.total_contribution_points).toBe(0);
      expect(profile.guest_rank).toBe('Party Newbie');
      expect(profile.parties_joined).toBe(0);
    });

    test('getOrCreateGuestProfile() should return existing profile', async () => {
      const profile1 = await db.getOrCreateGuestProfile(testGuestId);
      const profile2 = await db.getOrCreateGuestProfile(testGuestId);
      
      expect(profile1.id).toBe(profile2.id);
    });

    test('getOrCreateGuestProfile() should handle null nickname', async () => {
      const guestId = `test-guest-null-${Date.now()}`;
      const profile = await db.getOrCreateGuestProfile(guestId, null);
      
      expect(profile.guest_identifier).toBe(guestId);
      expect(profile.nickname).toBeNull();
    });

    test('updateGuestProfile() should update guest stats with UPSERT', async () => {
      const guestId = `test-guest-update-${Date.now()}`;
      
      const updated = await db.updateGuestProfile(guestId, {
        contributionPoints: 10,
        reactionsCount: 5,
        messagesCount: 3
      });
      
      expect(updated).toBeDefined();
      expect(updated.guest_identifier).toBe(guestId);
      expect(updated.total_contribution_points).toBe(10);
      expect(updated.total_reactions_sent).toBe(5);
      expect(updated.total_messages_sent).toBe(3);
    });

    test('updateGuestProfile() should accumulate points on existing profile', async () => {
      const guestId = `test-guest-accumulate-${Date.now()}`;
      
      // First update
      await db.updateGuestProfile(guestId, {
        contributionPoints: 10,
        reactionsCount: 5,
        messagesCount: 3
      });
      
      // Second update
      const updated = await db.updateGuestProfile(guestId, {
        contributionPoints: 5,
        reactionsCount: 2,
        messagesCount: 1
      });
      
      expect(updated.total_contribution_points).toBe(15);
      expect(updated.total_reactions_sent).toBe(7);
      expect(updated.total_messages_sent).toBe(4);
    });

    test('updateGuestProfile() should handle zero values', async () => {
      const guestId = `test-guest-zero-${Date.now()}`;
      
      const updated = await db.updateGuestProfile(guestId, {
        contributionPoints: 0,
        reactionsCount: 0,
        messagesCount: 0
      });
      
      expect(updated.total_contribution_points).toBe(0);
      expect(updated.total_reactions_sent).toBe(0);
      expect(updated.total_messages_sent).toBe(0);
    });

    test('incrementGuestPartiesJoined() should increment parties counter', async () => {
      const guestId = `test-guest-parties-${Date.now()}`;
      
      // Create profile first
      await db.getOrCreateGuestProfile(guestId, 'Party Guest');
      
      const updated = await db.incrementGuestPartiesJoined(guestId);
      
      expect(updated).toBeDefined();
      expect(updated.parties_joined).toBe(1);
      
      // Increment again
      const updated2 = await db.incrementGuestPartiesJoined(guestId);
      expect(updated2.parties_joined).toBe(2);
    });

    test('getTopGuests() should return top guests by contribution points', async () => {
      // Create several test guests with different scores
      const timestamp = Date.now();
      await db.updateGuestProfile(`guest-top-1-${timestamp}`, { contributionPoints: 100 });
      await db.updateGuestProfile(`guest-top-2-${timestamp}`, { contributionPoints: 200 });
      await db.updateGuestProfile(`guest-top-3-${timestamp}`, { contributionPoints: 50 });
      
      const topGuests = await db.getTopGuests(10);
      
      expect(Array.isArray(topGuests)).toBe(true);
      expect(topGuests.length).toBeGreaterThan(0);
      
      // Check that results are sorted by contribution points (descending)
      if (topGuests.length > 1) {
        for (let i = 0; i < topGuests.length - 1; i++) {
          expect(topGuests[i].total_contribution_points)
            .toBeGreaterThanOrEqual(topGuests[i + 1].total_contribution_points);
        }
      }
    });

    test('getTopGuests() should respect limit parameter', async () => {
      const topGuests = await db.getTopGuests(5);
      
      expect(topGuests.length).toBeLessThanOrEqual(5);
    });
  });

  describeIfDb('DJ Profile Functions', () => {
    let testUserId;
    
    beforeAll(async () => {
      // Create a test user for DJ profile tests
      const result = await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-dj-${Date.now()}@example.com`, 'hash', 'Test DJ']
      );
      testUserId = result.rows[0].id;
    });

    test('updateDjProfileScore() should create DJ profile with score', async () => {
      const profile = await db.updateDjProfileScore(testUserId, 100);
      
      expect(profile).toBeDefined();
      expect(profile.user_id).toBe(testUserId);
      expect(profile.dj_score).toBe(100);
      expect(profile.dj_rank).toBe('Bedroom DJ');
    });

    test('updateDjProfileScore() should accumulate scores', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-dj-accumulate-${Date.now()}@example.com`, 'hash', 'DJ Accumulate']
      )).rows[0].id;
      
      await db.updateDjProfileScore(userId, 50);
      const updated = await db.updateDjProfileScore(userId, 75);
      
      expect(updated.dj_score).toBe(125);
    });

    test('updateDjProfileScore() should handle zero scores', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-dj-zero-${Date.now()}@example.com`, 'hash', 'DJ Zero']
      )).rows[0].id;
      
      const profile = await db.updateDjProfileScore(userId, 0);
      
      expect(profile.dj_score).toBe(0);
    });

    test('getTopDjs() should return top DJs by score', async () => {
      // Create several test DJs with different scores
      const timestamp = Date.now();
      
      const dj1 = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) VALUES ($1, $2, $3) RETURNING id`,
        [`dj-top-1-${timestamp}@example.com`, 'hash', 'DJ Top 1']
      )).rows[0].id;
      await db.activateProMonthly(dj1, 'test', `sub_dj1_${timestamp}`);
      await db.updateDjProfileScore(dj1, 500);
      
      const dj2 = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) VALUES ($1, $2, $3) RETURNING id`,
        [`dj-top-2-${timestamp}@example.com`, 'hash', 'DJ Top 2']
      )).rows[0].id;
      await db.activateProMonthly(dj2, 'test', `sub_dj2_${timestamp}`);
      await db.updateDjProfileScore(dj2, 1000);
      
      const topDjs = await db.getTopDjs(10);
      
      expect(Array.isArray(topDjs)).toBe(true);
      expect(topDjs.length).toBeGreaterThan(0);
      
      // Check that results are sorted by DJ score (descending)
      if (topDjs.length > 1) {
        for (let i = 0; i < topDjs.length - 1; i++) {
          expect(topDjs[i].dj_score).toBeGreaterThanOrEqual(topDjs[i + 1].dj_score);
        }
      }
    });

    test('getTopDjs() should respect limit parameter', async () => {
      const topDjs = await db.getTopDjs(3);
      
      expect(topDjs.length).toBeLessThanOrEqual(3);
    });

    test('getTopDjs() should include dj_name from users table', async () => {
      const topDjs = await db.getTopDjs(1);
      
      if (topDjs.length > 0) {
        expect(topDjs[0].dj_name).toBeDefined();
      }
    });
  });

  describeIfDb('Party Scoreboard Functions', () => {
    const testPartyCode = `TEST-${Date.now()}`;
    let testUserId;
    
    beforeAll(async () => {
      // Create a test user for scoreboard tests
      const result = await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-scoreboard-${Date.now()}@example.com`, 'hash', 'Scoreboard DJ']
      );
      testUserId = result.rows[0].id;
    });

    test('savePartyScoreboard() should save party session data', async () => {
      const scoreboardData = {
        partyCode: testPartyCode,
        hostUserId: testUserId,
        hostIdentifier: 'host-123',
        djSessionScore: 500,
        guestScores: [
          { guestId: 'guest-1', nickname: 'Guest One', points: 100, emojis: 10, messages: 5 },
          { guestId: 'guest-2', nickname: 'Guest Two', points: 150, emojis: 15, messages: 8 }
        ],
        partyDurationMinutes: 120,
        totalReactions: 25,
        totalMessages: 13,
        peakCrowdEnergy: 85
      };
      
      const result = await db.savePartyScoreboard(scoreboardData);
      
      expect(result).toBeDefined();
      expect(result.party_code).toBe(testPartyCode);
      expect(result.dj_session_score).toBe(500);
      expect(result.party_duration_minutes).toBe(120);
      expect(result.total_reactions).toBe(25);
      expect(result.total_messages).toBe(13);
      expect(result.peak_crowd_energy).toBe(85);
    });

    test('savePartyScoreboard() should handle empty guest scores', async () => {
      const partyCode = `TEST-EMPTY-${Date.now()}`;
      
      const scoreboardData = {
        partyCode,
        hostUserId: testUserId,
        hostIdentifier: 'host-456',
        djSessionScore: 100,
        guestScores: [],
        partyDurationMinutes: 30,
        totalReactions: 0,
        totalMessages: 0,
        peakCrowdEnergy: 0
      };
      
      const result = await db.savePartyScoreboard(scoreboardData);
      
      expect(result).toBeDefined();
      expect(result.party_code).toBe(partyCode);
      expect(result.total_reactions).toBe(0);
    });

    test('getPartyScoreboard() should retrieve saved scoreboard', async () => {
      const scoreboard = await db.getPartyScoreboard(testPartyCode);
      
      expect(scoreboard).toBeDefined();
      expect(scoreboard.party_code).toBe(testPartyCode);
      expect(scoreboard.dj_session_score).toBe(500);
      expect(Array.isArray(scoreboard.guest_scores)).toBe(true);
      expect(scoreboard.guest_scores.length).toBe(2);
      expect(scoreboard.guest_scores[0].nickname).toBe('Guest One');
    });

    test('getPartyScoreboard() should return most recent session', async () => {
      const partyCode = `TEST-MULTI-${Date.now()}`;
      
      // Save first session
      await db.savePartyScoreboard({
        partyCode,
        hostUserId: testUserId,
        hostIdentifier: 'host-789',
        djSessionScore: 100,
        guestScores: [],
        partyDurationMinutes: 30,
        totalReactions: 5,
        totalMessages: 2,
        peakCrowdEnergy: 50
      });
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Save second session
      await db.savePartyScoreboard({
        partyCode,
        hostUserId: testUserId,
        hostIdentifier: 'host-789',
        djSessionScore: 200,
        guestScores: [],
        partyDurationMinutes: 60,
        totalReactions: 10,
        totalMessages: 5,
        peakCrowdEnergy: 75
      });
      
      const scoreboard = await db.getPartyScoreboard(partyCode);
      
      // Should return the most recent session
      expect(scoreboard.dj_session_score).toBe(200);
      expect(scoreboard.party_duration_minutes).toBe(60);
    });

    test('getPartyScoreboard() should return null for non-existent party', async () => {
      const scoreboard = await db.getPartyScoreboard('NON-EXISTENT-CODE');
      
      expect(scoreboard).toBeNull();
    });
  });

  describeIfDb('User Upgrades Functions', () => {
    let testUserId;
    
    beforeAll(async () => {
      // Create a test user for upgrades tests
      const result = await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-upgrades-${Date.now()}@example.com`, 'hash', 'Upgrades User']
      );
      testUserId = result.rows[0].id;
    });

    test('getOrCreateUserUpgrades() should create new upgrades record', async () => {
      const upgrades = await db.getOrCreateUserUpgrades(testUserId);
      
      expect(upgrades).toBeDefined();
      expect(upgrades.user_id).toBe(testUserId);
      expect(upgrades.pro_monthly_active).toBe(false);
      expect(upgrades.party_pass_expires_at).toBeNull();
    });

    test('getOrCreateUserUpgrades() should return existing upgrades', async () => {
      const upgrades1 = await db.getOrCreateUserUpgrades(testUserId);
      const upgrades2 = await db.getOrCreateUserUpgrades(testUserId);
      
      expect(upgrades1.id).toBe(upgrades2.id);
    });

    test('updatePartyPassExpiry() should set expiration date', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-partypass-${Date.now()}@example.com`, 'hash', 'PartyPass User']
      )).rows[0].id;
      
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const updated = await db.updatePartyPassExpiry(userId, expiresAt);
      
      expect(updated).toBeDefined();
      expect(updated.user_id).toBe(userId);
      expect(new Date(updated.party_pass_expires_at).getTime())
        .toBeCloseTo(expiresAt.getTime(), -3); // Allow up to 1000ms (1 second) difference
    });

    test('updatePartyPassExpiry() should update existing expiration', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-partypass-update-${Date.now()}@example.com`, 'hash', 'PartyPass Update User']
      )).rows[0].id;
      
      const firstExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db.updatePartyPassExpiry(userId, firstExpiry);
      
      const secondExpiry = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
      const updated = await db.updatePartyPassExpiry(userId, secondExpiry);
      
      expect(new Date(updated.party_pass_expires_at).getTime())
        .toBeCloseTo(secondExpiry.getTime(), -3); // Allow up to 1000ms (1 second) difference
    });

    test('activateProMonthly() should activate Pro subscription', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-pro-${Date.now()}@example.com`, 'hash', 'Pro User']
      )).rows[0].id;
      
      const updated = await db.activateProMonthly(userId, 'stripe', 'sub_123456');
      
      expect(updated).toBeDefined();
      expect(updated.user_id).toBe(userId);
      expect(updated.pro_monthly_active).toBe(true);
      expect(updated.pro_monthly_renewal_provider).toBe('stripe');
      expect(updated.pro_monthly_provider_subscription_id).toBe('sub_123456');
      expect(updated.pro_monthly_started_at).toBeDefined();
    });

    test('activateProMonthly() should preserve started_at on reactivation', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-pro-reactivate-${Date.now()}@example.com`, 'hash', 'Pro Reactivate User']
      )).rows[0].id;
      
      const first = await db.activateProMonthly(userId, 'stripe', 'sub_111');
      const firstStartedAt = first.pro_monthly_started_at;
      
      // Deactivate
      await db.deactivateProMonthly(userId);
      
      // Reactivate
      const second = await db.activateProMonthly(userId, 'stripe', 'sub_222');
      
      // started_at should be the same
      expect(new Date(second.pro_monthly_started_at).getTime())
        .toBe(new Date(firstStartedAt).getTime());
    });

    test('deactivateProMonthly() should deactivate Pro subscription', async () => {
      const userId = (await db.query(
        `INSERT INTO users (email, password_hash, dj_name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [`test-pro-deactivate-${Date.now()}@example.com`, 'hash', 'Pro Deactivate User']
      )).rows[0].id;
      
      await db.activateProMonthly(userId, 'apple', 'sub_apple_123');
      
      const deactivated = await db.deactivateProMonthly(userId);
      
      expect(deactivated).toBeDefined();
      expect(deactivated.pro_monthly_active).toBe(false);
    });

    test('deactivateProMonthly() should return null for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      
      const result = await db.deactivateProMonthly(fakeUserId);
      
      expect(result).toBeNull();
    });
  });

  describe('Entitlement Resolution', () => {
    test('resolveEntitlements() should return false for null upgrades', () => {
      const entitlements = db.resolveEntitlements(null);
      
      expect(entitlements.hasPartyPass).toBe(false);
      expect(entitlements.hasPro).toBe(false);
    });

    test('resolveEntitlements() should return false for undefined upgrades', () => {
      const entitlements = db.resolveEntitlements(undefined);
      
      expect(entitlements.hasPartyPass).toBe(false);
      expect(entitlements.hasPro).toBe(false);
    });

    test('resolveEntitlements() should detect active Pro subscription', () => {
      const upgrades = {
        pro_monthly_active: true,
        party_pass_expires_at: null
      };
      
      const entitlements = db.resolveEntitlements(upgrades);
      
      expect(entitlements.hasPro).toBe(true);
      expect(entitlements.hasPartyPass).toBe(true); // Pro includes Party Pass
    });

    test('resolveEntitlements() should detect valid Party Pass', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const upgrades = {
        pro_monthly_active: false,
        party_pass_expires_at: futureDate.toISOString()
      };
      
      const entitlements = db.resolveEntitlements(upgrades);
      
      expect(entitlements.hasPro).toBe(false);
      expect(entitlements.hasPartyPass).toBe(true);
    });

    test('resolveEntitlements() should detect expired Party Pass', () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const upgrades = {
        pro_monthly_active: false,
        party_pass_expires_at: pastDate.toISOString()
      };
      
      const entitlements = db.resolveEntitlements(upgrades);
      
      expect(entitlements.hasPro).toBe(false);
      expect(entitlements.hasPartyPass).toBe(false);
    });

    test('resolveEntitlements() should prioritize Pro over Party Pass', () => {
      const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const upgrades = {
        pro_monthly_active: true,
        party_pass_expires_at: pastDate.toISOString()
      };
      
      const entitlements = db.resolveEntitlements(upgrades);
      
      expect(entitlements.hasPro).toBe(true);
      expect(entitlements.hasPartyPass).toBe(true); // Pro gives Party Pass even if expired
    });

    test('resolveEntitlements() should handle null Party Pass date', () => {
      const upgrades = {
        pro_monthly_active: false,
        party_pass_expires_at: null
      };
      
      const entitlements = db.resolveEntitlements(upgrades);
      
      expect(entitlements.hasPro).toBe(false);
      expect(entitlements.hasPartyPass).toBe(false);
    });
  });
});
