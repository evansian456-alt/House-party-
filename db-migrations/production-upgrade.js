/**
 * Database Migration Script for Production Upgrade
 * 
 * Creates tables for:
 * - Session metrics (analytics)
 * - Revenue metrics (MRR, ARPU tracking)
 * - User referrals
 * - Referral tracking
 * 
 * Run with: node db-migrations/production-upgrade.js
 */

const { Pool } = require('pg');

async function runMigration() {
  // Get database config from environment
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  console.log('[Migration] Starting production upgrade migration...');

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Session metrics table
      console.log('[Migration] Creating session_metrics table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS session_metrics (
          id SERIAL PRIMARY KEY,
          party_code VARCHAR(10) NOT NULL,
          user_id INTEGER REFERENCES users(id),
          tier VARCHAR(20) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          ended_at TIMESTAMP,
          duration_ms BIGINT,
          participant_count INTEGER
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_session_metrics_user ON session_metrics(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_session_metrics_created ON session_metrics(created_at)
      `);

      // 2. Revenue metrics table
      console.log('[Migration] Creating revenue_metrics table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS revenue_metrics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          product_id VARCHAR(50) NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'GBP',
          stripe_invoice_id VARCHAR(255),
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_revenue_metrics_user ON revenue_metrics(user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_revenue_metrics_created ON revenue_metrics(created_at)
      `);

      // 3. User referrals table
      console.log('[Migration] Creating user_referrals table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_referrals (
          id SERIAL PRIMARY KEY,
          user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          referral_code VARCHAR(10) UNIQUE NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_referrals_code ON user_referrals(referral_code)
      `);

      // 4. Referral tracking table
      console.log('[Migration] Creating referral_tracking table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS referral_tracking (
          id SERIAL PRIMARY KEY,
          referrer_user_id INTEGER REFERENCES users(id),
          referred_user_id INTEGER REFERENCES users(id),
          referral_code VARCHAR(10) NOT NULL,
          is_paid BOOLEAN DEFAULT FALSE,
          reward_granted BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          converted_at TIMESTAMP
        )
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_tracking_referrer ON referral_tracking(referrer_user_id)
      `);
      
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_referral_tracking_referred ON referral_tracking(referred_user_id)
      `);

      // 5. Add stripe_customer_id to users table if not exists
      console.log('[Migration] Adding stripe_customer_id to users table...');
      await client.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255)
      `);
      
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL
      `);

      // 6. Add status column to user_entitlements if not exists
      console.log('[Migration] Adding status to user_entitlements table...');
      await client.query(`
        ALTER TABLE user_entitlements 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
      `);

      // 7. Add source column to user_entitlements if not exists
      console.log('[Migration] Adding source to user_entitlements table...');
      await client.query(`
        ALTER TABLE user_entitlements 
        ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'purchase'
      `);

      await client.query('COMMIT');
      console.log('[Migration] ✅ Production upgrade migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };
