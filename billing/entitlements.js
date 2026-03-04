/**
 * billing/entitlements.js
 * Unified entitlement application layer.
 * Supports PostgreSQL (when DATABASE_URL is configured) and in-memory
 * fallback for Cloud Run / environments without a DB.
 */

'use strict';

const { getProduct } = require('./products');

// Duration for a party pass entitlement
const PARTY_PASS_INTERVAL = '2 hours'; // PostgreSQL interval
const PARTY_PASS_DURATION_MS = 2 * 60 * 60 * 1000; // milliseconds

// ── In-memory fallback storage ────────────────────────────────────────────────
// Used when DB is not available. Keyed by providerTransactionId for idempotency.
const _memPurchases = new Map();   // transactionId -> purchase record
const _memUserTiers = new Map();   // userId -> { userTier, partyPassActive, subscriptionStatus }

let _dbAvailable = null; // null = not yet tested, true/false = cached result

async function _checkDb(db) {
  if (_dbAvailable !== null) return _dbAvailable;
  try {
    await db.query('SELECT 1');
    _dbAvailable = true;
  } catch (_) {
    _dbAvailable = false;
    console.warn('[Entitlements] Database not available – using in-memory storage');
  }
  return _dbAvailable;
}

// Exposed for testing only
function _resetMemStore() {
  _memPurchases.clear();
  _memUserTiers.clear();
  _dbAvailable = null;
}

// ── Ensure purchases table exists ─────────────────────────────────────────────
async function _ensurePurchasesTable(db) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS unified_purchases (
        id              SERIAL PRIMARY KEY,
        user_id         TEXT NOT NULL,
        product_key     TEXT NOT NULL,
        provider        TEXT NOT NULL,
        transaction_id  TEXT NOT NULL UNIQUE,
        raw             JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch (err) {
    console.warn('[Entitlements] Could not create unified_purchases table:', err.message);
  }
}

/**
 * Apply a purchase to a user.
 *
 * @param {object} opts
 * @param {string} opts.userId               - Internal user ID
 * @param {string} opts.productKey           - Key from billing/products.js
 * @param {string} opts.provider             - 'stripe' | 'apple' | 'google'
 * @param {string} opts.providerTransactionId - Unique transaction ID from provider
 * @param {object} [opts.raw]                - Raw provider payload (for audit)
 * @param {object} [opts.db]                 - Optional db module (defaults to require('../database'))
 * @returns {Promise<{applied: boolean, alreadyApplied: boolean, tier: string}>}
 */
async function applyPurchaseToUser({ userId, productKey, provider, providerTransactionId, raw, db: dbOverride } = {}) {
  // ── Input validation ──────────────────────────────────────────────────────
  if (!userId) throw new Error('applyPurchaseToUser: userId is required');
  if (!productKey) throw new Error('applyPurchaseToUser: productKey is required');
  if (!provider) throw new Error('applyPurchaseToUser: provider is required');
  if (!providerTransactionId) throw new Error('applyPurchaseToUser: providerTransactionId is required');

  const product = getProduct(productKey);
  if (!product) throw new Error(`applyPurchaseToUser: unknown productKey "${productKey}"`);

  const tier = product.entitlement.tier; // 'PARTY_PASS' or 'PRO'

  // ── Try database path ─────────────────────────────────────────────────────
  let db;
  try {
    db = dbOverride || require('../database');
  } catch (_) {
    db = null;
  }

  const useDb = db && (await _checkDb(db));

  if (useDb) {
    return _applyWithDb({ db, userId, productKey, provider, providerTransactionId, raw, tier });
  }

  return _applyInMemory({ userId, productKey, provider, providerTransactionId, raw, tier });
}

// ── DB-backed path ────────────────────────────────────────────────────────────
async function _applyWithDb({ db, userId, productKey, provider, providerTransactionId, raw, tier }) {
  await _ensurePurchasesTable(db);

  // Idempotency check
  try {
    const existing = await db.query(
      'SELECT id FROM unified_purchases WHERE transaction_id = $1',
      [providerTransactionId]
    );
    if (existing.rows.length > 0) {
      return { applied: false, alreadyApplied: true, tier };
    }
  } catch (err) {
    console.warn('[Entitlements] Idempotency check failed:', err.message);
  }

  // Write purchase record
  try {
    await db.query(
      `INSERT INTO unified_purchases (user_id, product_key, provider, transaction_id, raw)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (transaction_id) DO NOTHING`,
      [userId, productKey, provider, providerTransactionId, JSON.stringify(raw || {})]
    );
  } catch (err) {
    console.warn('[Entitlements] Failed to write purchase record:', err.message);
  }

  // Update user tier
  await _updateUserTierDb({ db, userId, tier });

  console.log(`[Entitlements] Applied ${productKey} (${provider}) to user ${userId} → tier=${tier}`);
  return { applied: true, alreadyApplied: false, tier };
}

async function _updateUserTierDb({ db, userId, tier }) {
  if (tier === 'PARTY_PASS') {
    try {
      // Update users table if it has tier column
      await db.query(
        `UPDATE users SET tier = $1 WHERE id = $2`,
        ['PARTY_PASS', userId]
      );
    } catch (_) { /* column may not exist yet */ }
    try {
      // Update user_upgrades table
      await db.query(
        `INSERT INTO user_upgrades (user_id, party_pass_expires_at, updated_at)
         VALUES ($1, NOW() + INTERVAL '${PARTY_PASS_INTERVAL}', NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET party_pass_expires_at = NOW() + INTERVAL '${PARTY_PASS_INTERVAL}', updated_at = NOW()`,
        [userId]
      );
    } catch (err) {
      console.warn('[Entitlements] Could not update user_upgrades for PARTY_PASS:', err.message);
    }
  } else if (tier === 'PRO') {
    try {
      await db.query(
        `UPDATE users SET tier = $1, subscription_status = 'active' WHERE id = $2`,
        ['PRO', userId]
      );
    } catch (_) { /* column may not exist */ }
    try {
      await db.query(
        `INSERT INTO user_upgrades (user_id, pro_monthly_active, pro_monthly_started_at, updated_at)
         VALUES ($1, TRUE, NOW(), NOW())
         ON CONFLICT (user_id) DO UPDATE
           SET pro_monthly_active = TRUE, pro_monthly_started_at = COALESCE(user_upgrades.pro_monthly_started_at, NOW()), updated_at = NOW()`,
        [userId]
      );
    } catch (err) {
      console.warn('[Entitlements] Could not update user_upgrades for PRO:', err.message);
    }
  }
}

// ── In-memory path ────────────────────────────────────────────────────────────
function _applyInMemory({ userId, productKey, provider, providerTransactionId, raw, tier }) {
  // Idempotency check
  if (_memPurchases.has(providerTransactionId)) {
    return Promise.resolve({ applied: false, alreadyApplied: true, tier });
  }

  // Write purchase record
  _memPurchases.set(providerTransactionId, {
    userId,
    productKey,
    provider,
    providerTransactionId,
    raw: raw || {},
    createdAt: new Date().toISOString()
  });

  // Update user tier
  const current = _memUserTiers.get(userId) || {};
  if (tier === 'PARTY_PASS') {
    _memUserTiers.set(userId, {
      ...current,
      userTier: 'PARTY_PASS',
      partyPassActive: true,
      partyPassExpiresAt: new Date(Date.now() + PARTY_PASS_DURATION_MS).toISOString()
    });
  } else if (tier === 'PRO') {
    _memUserTiers.set(userId, {
      ...current,
      userTier: 'PRO',
      subscriptionStatus: 'active'
    });
  }

  console.log(`[Entitlements] Applied ${productKey} (${provider}) to user ${userId} → tier=${tier} [in-memory]`);
  return Promise.resolve({ applied: true, alreadyApplied: false, tier });
}

/**
 * Get all in-memory purchases (for admin stats / testing)
 * @returns {object[]}
 */
function getMemPurchases() {
  return Array.from(_memPurchases.values());
}

/**
 * Get user tier from in-memory store (for testing/fallback)
 * @param {string} userId
 * @returns {object|null}
 */
function getMemUserTier(userId) {
  return _memUserTiers.get(userId) || null;
}

module.exports = {
  applyPurchaseToUser,
  getMemPurchases,
  getMemUserTier,
  _resetMemStore
};
