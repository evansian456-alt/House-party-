/**
 * Metrics Service
 * 
 * Tracks analytics for admin dashboard:
 * - Session metrics (created, ended, duration, participants)
 * - Revenue metrics (MRR, ARPU)
 * - User metrics (retention, churn)
 * - Performance metrics (avg drift, correction frequency)
 */

const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

class MetricsService {
  constructor(db, redis) {
    this.db = db;
    this.redis = redis;
    
    // In-memory metrics for realtime tracking
    this.metrics = {
      sessions: {
        created: 0,
        ended: 0,
        active: 0
      },
      users: {
        active: 0,
        totalSignups: 0
      },
      revenue: {
        totalRevenue: 0,
        mrr: 0
      }
    };
  }

  /**
   * Track session creation
   */
  async trackSessionCreated(partyCode, userId, tier) {
    this.metrics.sessions.created++;
    this.metrics.sessions.active++;

    try {
      // Store in Redis for cross-instance tracking
      await this.redis.hincrby('metrics:sessions', 'created', 1);
      await this.redis.hincrby('metrics:sessions', 'active', 1);
      
      // Store session details in database
      if (this.db) {
        await this.db.query(
          `INSERT INTO session_metrics 
           (party_code, user_id, tier, created_at) 
           VALUES ($1, $2, $3, NOW())`,
          [partyCode, userId, tier]
        );
      }

      if (DEBUG_MODE) {
        console.log(`[Metrics] Session created: ${partyCode} (tier: ${tier})`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking session creation:', error.message);
    }
  }

  /**
   * Track session end
   */
  async trackSessionEnded(partyCode, durationMs, participantCount) {
    this.metrics.sessions.ended++;
    this.metrics.sessions.active = Math.max(0, this.metrics.sessions.active - 1);

    try {
      await this.redis.hincrby('metrics:sessions', 'ended', 1);
      await this.redis.hincrby('metrics:sessions', 'active', -1);
      
      if (this.db) {
        await this.db.query(
          `UPDATE session_metrics 
           SET ended_at = NOW(), duration_ms = $2, participant_count = $3 
           WHERE party_code = $1`,
          [partyCode, durationMs, participantCount]
        );
      }

      if (DEBUG_MODE) {
        console.log(`[Metrics] Session ended: ${partyCode} (duration: ${durationMs}ms, participants: ${participantCount})`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking session end:', error.message);
    }
  }

  /**
   * Track revenue event
   */
  async trackRevenue(userId, productId, amount, currency = 'GBP') {
    this.metrics.revenue.totalRevenue += amount;

    try {
      if (this.db) {
        await this.db.query(
          `INSERT INTO revenue_metrics 
           (user_id, product_id, amount, currency, created_at) 
           VALUES ($1, $2, $3, $4, NOW())`,
          [userId, productId, amount, currency]
        );
      }

      // Update MRR for subscriptions
      if (productId === 'pro_monthly') {
        await this.redis.hincrbyfloat('metrics:revenue', 'mrr', amount);
      }

      if (DEBUG_MODE) {
        console.log(`[Metrics] Revenue: ${userId} purchased ${productId} for ${currency} ${amount}`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking revenue:', error.message);
    }
  }

  /**
   * Track drift/sync metrics
   */
  async trackDrift(partyCode, clientId, driftMs, correctionType) {
    try {
      const key = `metrics:drift:${partyCode}`;
      await this.redis.lpush(key, JSON.stringify({
        clientId,
        driftMs,
        correctionType,
        timestamp: Date.now()
      }));
      
      // Keep only last 100 drift samples
      await this.redis.ltrim(key, 0, 99);
      
      // Set expiry for 1 hour
      await this.redis.expire(key, 3600);
    } catch (error) {
      console.error('[Metrics] Error tracking drift:', error.message);
    }
  }

  /**
   * Track time_to_ready metric (Phase 10)
   * @param {string} partyCode - Party code
   * @param {string} clientId - Client identifier (no PII)
   * @param {number} timeToReadyMs - Time from PREPARE_PLAY to client ready (ms)
   */
  async trackTimeToReady(partyCode, clientId, timeToReadyMs) {
    try {
      const key = `metrics:time_to_ready:${partyCode}`;
      await this.redis.lpush(key, JSON.stringify({
        clientId,
        time_to_ready_ms: timeToReadyMs,
        timestamp: Date.now()
      }));
      
      // Keep only last 100 samples for p90 calculation
      await this.redis.ltrim(key, 0, 99);
      
      // Set expiry for 1 hour
      await this.redis.expire(key, 3600);
      
      if (DEBUG_MODE) {
        console.log(`[Metrics] time_to_ready_ms=${timeToReadyMs} party=${partyCode} client=${clientId}`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking time_to_ready:', error.message);
    }
  }

  /**
   * Track start error metric (Phase 10)
   * @param {string} partyCode - Party code
   * @param {string} clientId - Client identifier (no PII)
   * @param {number} startErrorMs - Difference between expected and actual start time (ms)
   */
  async trackStartError(partyCode, clientId, startErrorMs) {
    try {
      const key = `metrics:start_error:${partyCode}`;
      await this.redis.lpush(key, JSON.stringify({
        clientId,
        start_error_ms: startErrorMs,
        timestamp: Date.now()
      }));
      
      // Keep only last 100 samples
      await this.redis.ltrim(key, 0, 99);
      
      // Set expiry for 1 hour
      await this.redis.expire(key, 3600);
      
      if (DEBUG_MODE) {
        console.log(`[Metrics] start_error_ms=${startErrorMs} party=${partyCode} client=${clientId}`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking start_error:', error.message);
    }
  }

  /**
   * Track drift error metric (Phase 10)
   * @param {string} partyCode - Party code
   * @param {string} clientId - Client identifier (no PII)
   * @param {number} driftErrorMs - Drift from expected position (ms)
   */
  async trackDriftError(partyCode, clientId, driftErrorMs) {
    try {
      const key = `metrics:drift_error:${partyCode}`;
      await this.redis.lpush(key, JSON.stringify({
        clientId,
        drift_error_ms: driftErrorMs,
        timestamp: Date.now()
      }));
      
      // Keep only last 100 samples
      await this.redis.ltrim(key, 0, 99);
      
      // Set expiry for 1 hour
      await this.redis.expire(key, 3600);
      
      if (DEBUG_MODE) {
        console.log(`[Metrics] drift_error_ms=${driftErrorMs} party=${partyCode} client=${clientId}`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking drift_error:', error.message);
    }
  }

  /**
   * Track reconnection event (Phase 10)
   * @param {string} partyCode - Party code
   * @param {string} clientId - Client identifier (no PII)
   */
  async trackReconnect(partyCode, clientId) {
    try {
      const key = `metrics:reconnects:${partyCode}`;
      await this.redis.hincrby(key, clientId, 1);
      
      // Set expiry for 1 hour
      await this.redis.expire(key, 3600);
      
      if (DEBUG_MODE) {
        console.log(`[Metrics] reconnect_count++ party=${partyCode} client=${clientId}`);
      }
    } catch (error) {
      console.error('[Metrics] Error tracking reconnect:', error.message);
    }
  }

  /**
   * Get time_to_ready metrics for a party (Phase 9)
   * @param {string} partyCode - Party code
   * @returns {object} Statistics including p90
   */
  async getTimeToReadyStats(partyCode) {
    try {
      const key = `metrics:time_to_ready:${partyCode}`;
      const data = await this.redis.lrange(key, 0, -1);
      
      if (data.length === 0) {
        return { count: 0, avg: 0, p90: 0, max: 0 };
      }

      const times = data.map(d => JSON.parse(d).time_to_ready_ms).sort((a, b) => a - b);
      const count = times.length;
      const avg = times.reduce((sum, t) => sum + t, 0) / count;
      const p90Index = Math.floor(count * 0.9);
      const p90 = times[p90Index] || times[count - 1];
      const max = times[count - 1];

      return { count, avg: Math.round(avg), p90: Math.round(p90), max: Math.round(max) };
    } catch (error) {
      console.error('[Metrics] Error getting time_to_ready stats:', error.message);
      return { count: 0, avg: 0, p90: 0, max: 0 };
    }
  }

  /**
   * Get reconnect count for a party (Phase 10)
   * @param {string} partyCode - Party code
   * @returns {number} Total reconnect count
   */
  async getReconnectCount(partyCode) {
    try {
      const key = `metrics:reconnects:${partyCode}`;
      const counts = await this.redis.hvals(key);
      return counts.reduce((sum, c) => sum + parseInt(c), 0);
    } catch (error) {
      console.error('[Metrics] Error getting reconnect count:', error.message);
      return 0;
    }
  }

  /**
   * Get current metrics
   */
  async getMetrics() {
    try {
      // Get Redis metrics
      const sessionsCreated = await this.redis.hget('metrics:sessions', 'created') || 0;
      const sessionsEnded = await this.redis.hget('metrics:sessions', 'ended') || 0;
      const sessionsActive = await this.redis.hget('metrics:sessions', 'active') || 0;
      const mrr = await this.redis.hget('metrics:revenue', 'mrr') || 0;

      // Get database metrics
      let avgDuration = 0;
      let avgParticipants = 0;
      let totalRevenue = 0;
      let activeUsers = 0;

      if (this.db) {
        // Average session duration
        const durationResult = await this.db.query(
          `SELECT AVG(duration_ms) as avg_duration FROM session_metrics WHERE duration_ms IS NOT NULL`
        );
        avgDuration = durationResult.rows[0]?.avg_duration || 0;

        // Average participants
        const participantsResult = await this.db.query(
          `SELECT AVG(participant_count) as avg_participants FROM session_metrics WHERE participant_count IS NOT NULL`
        );
        avgParticipants = participantsResult.rows[0]?.avg_participants || 0;

        // Total revenue
        const revenueResult = await this.db.query(
          `SELECT SUM(amount) as total FROM revenue_metrics`
        );
        totalRevenue = revenueResult.rows[0]?.total || 0;

        // Active users (last 7 days)
        const activeUsersResult = await this.db.query(
          `SELECT COUNT(DISTINCT user_id) as count FROM session_metrics 
           WHERE created_at > NOW() - INTERVAL '7 days'`
        );
        activeUsers = activeUsersResult.rows[0]?.count || 0;
      }

      return {
        sessions: {
          created: parseInt(sessionsCreated),
          ended: parseInt(sessionsEnded),
          active: parseInt(sessionsActive),
          avgDurationMs: Math.round(avgDuration),
          avgParticipants: Math.round(avgParticipants * 10) / 10
        },
        revenue: {
          total: Math.round(totalRevenue * 100) / 100,
          mrr: Math.round(parseFloat(mrr) * 100) / 100,
          arpu: activeUsers > 0 ? Math.round((parseFloat(mrr) / activeUsers) * 100) / 100 : 0
        },
        users: {
          active: activeUsers
        }
      };
    } catch (error) {
      console.error('[Metrics] Error getting metrics:', error.message);
      return this.metrics;
    }
  }

  /**
   * Get drift metrics for a party
   */
  async getDriftMetrics(partyCode) {
    try {
      const key = `metrics:drift:${partyCode}`;
      const driftData = await this.redis.lrange(key, 0, -1);
      
      if (driftData.length === 0) {
        return { avgDrift: 0, maxDrift: 0, correctionCount: 0 };
      }

      const drifts = driftData.map(d => JSON.parse(d));
      const avgDrift = drifts.reduce((sum, d) => sum + Math.abs(d.driftMs), 0) / drifts.length;
      const maxDrift = Math.max(...drifts.map(d => Math.abs(d.driftMs)));
      const correctionCount = drifts.filter(d => d.correctionType !== 'none').length;

      return {
        avgDrift: Math.round(avgDrift),
        maxDrift: Math.round(maxDrift),
        correctionCount
      };
    } catch (error) {
      console.error('[Metrics] Error getting drift metrics:', error.message);
      return { avgDrift: 0, maxDrift: 0, correctionCount: 0 };
    }
  }
}

module.exports = { MetricsService };
