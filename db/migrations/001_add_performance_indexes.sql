-- Migration: Add Performance Indexes
-- Date: 2026-02-09
-- Description: Add indexes to optimize leaderboard queries and purchase lookups
-- Reference: IMPROVEMENT_SUGGESTIONS.md Section 4.3

-- Purchase lookups optimization
CREATE INDEX IF NOT EXISTS idx_purchases_user_created ON purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_item_active ON purchases(item_type, item_key);

-- Subscription queries optimization  
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Party scoreboard performance for leaderboards
CREATE INDEX IF NOT EXISTS idx_party_scoreboard_host_created ON party_scoreboard_sessions(host_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_party_scoreboard_created ON party_scoreboard_sessions(created_at DESC);

-- Guest leaderboard optimization (already has idx_guest_profiles_points)
-- DJ leaderboard optimization - currently using dj_profiles which is keyed by user_id
-- Future: When adding total_parties_hosted, peak_guest_count, total_party_time_hours to users table:
-- CREATE INDEX IF NOT EXISTS idx_users_total_parties ON users(total_parties_hosted DESC);
-- CREATE INDEX IF NOT EXISTS idx_users_peak_guests ON users(peak_guest_count DESC);
-- CREATE INDEX IF NOT EXISTS idx_users_total_time ON users(total_party_time_hours DESC);
