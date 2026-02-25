/**
 * Referral System
 * 
 * Viral referral tracking and rewards:
 * - Generate unique invite links
 * - Track referral usage
 * - Reward logic: 5 paid referrals = 1 free month
 */

const { customAlphabet } = require('nanoid');
const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Generate readable referral codes (8 chars, alphanumeric)
const generateReferralCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

class ReferralSystem {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
    
    // Reward threshold
    this.PAID_REFERRALS_FOR_REWARD = 5; // 5 paid referrals = 1 free month
    this.REWARD_DURATION_DAYS = 30; // 1 month free
  }

  /**
   * Get or create referral code for user
   */
  async getReferralCode(userId) {
    try {
      // Check if user already has a code
      if (this.db) {
        const result = await this.db.query(
          'SELECT referral_code FROM user_referrals WHERE user_id = $1',
          [userId]
        );

        if (result.rows.length > 0) {
          return result.rows[0].referral_code;
        }
      }

      // Generate new code
      const code = generateReferralCode();

      // Store in database
      if (this.db) {
        await this.db.query(
          `INSERT INTO user_referrals (user_id, referral_code, created_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (user_id) DO NOTHING`,
          [userId, code]
        );
      }

      // Cache in Redis
      await this.redis.set(`referral:code:${userId}`, code, 'EX', 86400 * 30); // 30 days
      await this.redis.set(`referral:user:${code}`, userId, 'EX', 86400 * 30);

      if (DEBUG_MODE) {
        console.log(`[Referral] Generated code for user ${userId}: ${code}`);
      }

      return code;
    } catch (error) {
      console.error('[Referral] Error getting referral code:', error.message);
      return null;
    }
  }

  /**
   * Track referral usage when new user signs up
   */
  async trackReferral(referralCode, newUserId, isPaid = false) {
    try {
      // Get referring user
      let referrerUserId = await this.redis.get(`referral:user:${referralCode}`);

      if (!referrerUserId && this.db) {
        const result = await this.db.query(
          'SELECT user_id FROM user_referrals WHERE referral_code = $1',
          [referralCode]
        );
        if (result.rows.length > 0) {
          referrerUserId = result.rows[0].user_id;
          // Cache for next time
          await this.redis.set(`referral:user:${referralCode}`, referrerUserId, 'EX', 86400 * 30);
        }
      }

      if (!referrerUserId) {
        console.log(`[Referral] Invalid referral code: ${referralCode}`);
        return false;
      }

      // Store referral
      if (this.db) {
        await this.db.query(
          `INSERT INTO referral_tracking 
           (referrer_user_id, referred_user_id, referral_code, is_paid, created_at) 
           VALUES ($1, $2, $3, $4, NOW())`,
          [referrerUserId, newUserId, referralCode, isPaid]
        );
      }

      // Increment counters
      await this.redis.hincrby(`referral:stats:${referrerUserId}`, 'total', 1);
      if (isPaid) {
        await this.redis.hincrby(`referral:stats:${referrerUserId}`, 'paid', 1);
      }

      if (DEBUG_MODE) {
        console.log(`[Referral] Tracked: ${referrerUserId} referred ${newUserId} (paid: ${isPaid})`);
      }

      // Check if reward threshold reached
      await this.checkAndGrantReward(referrerUserId);

      return true;
    } catch (error) {
      console.error('[Referral] Error tracking referral:', error.message);
      return false;
    }
  }

  /**
   * Mark a referral as converted to paid
   */
  async markReferralAsPaid(newUserId) {
    try {
      if (!this.db) return false;

      // Find the referral record
      const result = await this.db.query(
        `UPDATE referral_tracking 
         SET is_paid = true, converted_at = NOW() 
         WHERE referred_user_id = $1 AND is_paid = false 
         RETURNING referrer_user_id`,
        [newUserId]
      );

      if (result.rows.length > 0) {
        const referrerUserId = result.rows[0].referrer_user_id;
        
        // Update Redis counter
        await this.redis.hincrby(`referral:stats:${referrerUserId}`, 'paid', 1);

        if (DEBUG_MODE) {
          console.log(`[Referral] Marked as paid: ${newUserId} referred by ${referrerUserId}`);
        }

        // Check if reward threshold reached
        await this.checkAndGrantReward(referrerUserId);

        return true;
      }

      return false;
    } catch (error) {
      console.error('[Referral] Error marking referral as paid:', error.message);
      return false;
    }
  }

  /**
   * Check if user has earned a reward and grant it
   */
  async checkAndGrantReward(userId) {
    try {
      if (!this.db) return;

      // Count paid referrals
      const result = await this.db.query(
        `SELECT COUNT(*) as paid_count, 
                COUNT(*) FILTER (WHERE reward_granted = true) as rewarded_count 
         FROM referral_tracking 
         WHERE referrer_user_id = $1 AND is_paid = true`,
        [userId]
      );

      const paidCount = parseInt(result.rows[0].paid_count);
      const rewardedCount = parseInt(result.rows[0].rewarded_count);

      // Calculate how many rewards should be granted
      const totalRewardsEarned = Math.floor(paidCount / this.PAID_REFERRALS_FOR_REWARD);
      const rewardsToGrant = totalRewardsEarned - rewardedCount;

      if (rewardsToGrant > 0) {
        // Grant Pro subscription for reward duration
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (this.REWARD_DURATION_DAYS * rewardsToGrant));

        await this.db.query(
          `INSERT INTO user_entitlements 
           (user_id, product_id, granted_at, expires_at, source) 
           VALUES ($1, 'pro_monthly', NOW(), $2, 'referral_reward') 
           ON CONFLICT (user_id, product_id) 
           DO UPDATE SET expires_at = GREATEST(user_entitlements.expires_at, $2)`,
          [userId, expiryDate]
        );

        // Mark referrals as rewarded
        await this.db.query(
          `UPDATE referral_tracking 
           SET reward_granted = true 
           WHERE id IN (
             SELECT id FROM referral_tracking 
             WHERE referrer_user_id = $1 AND is_paid = true AND reward_granted = false 
             LIMIT $2
           )`,
          [userId, rewardsToGrant * this.PAID_REFERRALS_FOR_REWARD]
        );

        console.log(`[Referral] Granted ${rewardsToGrant} reward(s) to user ${userId} (${this.REWARD_DURATION_DAYS * rewardsToGrant} days Pro)`);
      }
    } catch (error) {
      console.error('[Referral] Error checking reward:', error.message);
    }
  }

  /**
   * Get referral stats for a user
   */
  async getReferralStats(userId) {
    try {
      // Try Redis first for speed
      const cached = await this.redis.hgetall(`referral:stats:${userId}`);
      if (cached && cached.total) {
        const total = parseInt(cached.total) || 0;
        const paid = parseInt(cached.paid) || 0;
        const progress = paid % this.PAID_REFERRALS_FOR_REWARD;
        const rewardsEarned = Math.floor(paid / this.PAID_REFERRALS_FOR_REWARD);

        return {
          referralCode: await this.getReferralCode(userId),
          totalReferrals: total,
          paidReferrals: paid,
          progressTowardReward: progress,
          rewardsEarned
        };
      }

      // Fallback to database
      if (this.db) {
        const result = await this.db.query(
          `SELECT 
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_paid = true) as paid,
             COUNT(*) FILTER (WHERE reward_granted = true) as rewarded
           FROM referral_tracking 
           WHERE referrer_user_id = $1`,
          [userId]
        );

        const total = parseInt(result.rows[0].total) || 0;
        const paid = parseInt(result.rows[0].paid) || 0;
        const progress = paid % this.PAID_REFERRALS_FOR_REWARD;
        const rewardsEarned = Math.floor(paid / this.PAID_REFERRALS_FOR_REWARD);

        // Cache in Redis
        await this.redis.hset(`referral:stats:${userId}`, 'total', total);
        await this.redis.hset(`referral:stats:${userId}`, 'paid', paid);
        await this.redis.expire(`referral:stats:${userId}`, 3600); // 1 hour

        return {
          referralCode: await this.getReferralCode(userId),
          totalReferrals: total,
          paidReferrals: paid,
          progressTowardReward: progress,
          rewardsEarned
        };
      }

      return {
        referralCode: await this.getReferralCode(userId),
        totalReferrals: 0,
        paidReferrals: 0,
        progressTowardReward: 0,
        rewardsEarned: 0
      };
    } catch (error) {
      console.error('[Referral] Error getting stats:', error.message);
      return {
        referralCode: null,
        totalReferrals: 0,
        paidReferrals: 0,
        progressTowardReward: 0,
        rewardsEarned: 0
      };
    }
  }

  /**
   * Generate invite link for a user
   */
  async getInviteLink(userId) {
    const code = await this.getReferralCode(userId);
    if (!code) return null;

    const baseUrl = process.env.BASE_URL || 'https://phone-party.up.railway.app';
    return `${baseUrl}?ref=${code}`;
  }
}

module.exports = { ReferralSystem };
