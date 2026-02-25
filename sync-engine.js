/**
 * SyncSpeaker Ultimate AmpSync+ Engine
 * 
 * High-precision multi-device audio/video synchronization system
 * Features:
 * - NTP-like clock synchronization
 * - Predictive drift compensation
 * - Rolling buffer management
 * - Real-time latency compensation
 * - Multi-device feedback loop
 */

// ============================================================
// Configuration
// ============================================================

const {
  CLOCK_SYNC_INTERVAL_MS,
  CLOCK_SYNC_MIN_INTERVAL_MS,
  CLOCK_SYNC_MAX_INTERVAL_MS,
  PLAYBACK_FEEDBACK_INTERVAL_MS,
  DRIFT_CORRECTION_INTERVAL_MS,
  ROLLING_BUFFER_MS,
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_MAX,
  DRIFT_THRESHOLD_MS,
  DESYNC_THRESHOLD_MS,
  PREDICTION_FACTOR,
  NETWORK_STABILITY_SAMPLES,
  NETWORK_STABILITY_NORMALIZATION_FACTOR,
  DEFAULT_START_DELAY_MS
} = require('./sync-config');

// ============================================================
// Client Metadata Structure
// ============================================================

/**
 * Represents a connected client in the sync system
 * Tracks clock synchronization, network metrics, and playback state
 * 
 * @class SyncClient
 * @property {WebSocket} ws - WebSocket connection to the client
 * @property {string} clientId - Unique identifier for the client
 * @property {number} clockOffset - Client clock offset from server (ms)
 * @property {number} latency - Round-trip network latency (ms)
 * @property {number} lastDrift - Most recent measured drift (ms)
 * @property {Array<{time: number, drift: number}>} driftHistory - Historical drift measurements
 * @property {string|null} peerId - P2P peer ID for WebRTC connections
 * @property {number|null} lastPingTime - Timestamp of last clock sync
 * @property {number} networkStability - Network stability score (0-1, higher is better)
 * @property {Array<number>} latencyHistory - Recent latency measurements
 * @property {number} playbackRate - Current playback rate adjustment factor
 * @property {number|null} lastFeedbackTime - Timestamp of last playback feedback
 * @property {number} playbackPosition - Current playback position (seconds)
 * @property {number} predictedDrift - Predicted future drift (ms)
 */
class SyncClient {
  /**
   * Create a new sync client
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Unique client identifier
   */
  constructor(ws, clientId) {
    this.ws = ws;
    this.clientId = clientId;
    this.clockOffset = 0;           // Client clock offset from server (ms)
    this.latency = 0;               // Round-trip latency (ms)
    this.lastDrift = 0;             // Last measured drift (ms)
    this.driftHistory = [];         // Drift history for prediction
    this.peerId = null;             // P2P peer ID (for WebRTC)
    this.lastPingTime = null;       // Last ping timestamp
    this.networkStability = 1.0;    // Network stability score (0-1)
    this.latencyHistory = [];       // Latency history for stability calculation
    this.playbackRate = 1.0;        // Current playback rate adjustment
    this.lastFeedbackTime = null;   // Last playback feedback timestamp
    this.playbackPosition = 0;      // Current playback position (seconds)
    this.predictedDrift = 0;        // Predicted drift for proactive correction
  }

  /**
   * Update clock offset based on ping/pong exchange
   * @param {number} sentTime - Client timestamp when ping was sent
   * @param {number} serverNowMs - Server timestamp when pong was sent
   * @param {number} receivedTime - Client timestamp when pong was received
   */
  updateClockSync(sentTime, serverNowMs, receivedTime) {
    // Calculate round-trip latency
    const roundTripMs = receivedTime - sentTime;
    this.latency = roundTripMs / 2;

    // Store latency history for stability calculation
    this.latencyHistory.push(this.latency);
    if (this.latencyHistory.length > NETWORK_STABILITY_SAMPLES) {
      this.latencyHistory.shift();
    }

    // Calculate network stability (inverse of latency variance)
    if (this.latencyHistory.length >= 3) {
      const mean = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
      const variance = this.latencyHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.latencyHistory.length;
      const stdDev = Math.sqrt(variance);
      // Stability is inversely proportional to standard deviation (normalized to 0-1)
      this.networkStability = Math.max(0, 1 - (stdDev / NETWORK_STABILITY_NORMALIZATION_FACTOR));
    }

    // Calculate clock offset: client time = server time + offset
    // offset = (sentTime + latency) - serverNowMs
    this.clockOffset = sentTime + this.latency - serverNowMs;
    this.lastPingTime = Date.now();
  }

  /**
   * Get adaptive sync interval based on network stability
   * More stable network = longer interval (less frequent syncs)
   */
  getAdaptiveSyncInterval() {
    const baseInterval = CLOCK_SYNC_INTERVAL_MS;
    const stabilityFactor = this.networkStability || 1.0;
    // Higher stability allows longer intervals
    const interval = baseInterval + (stabilityFactor * 2000);
    return Math.min(Math.max(interval, CLOCK_SYNC_MIN_INTERVAL_MS), CLOCK_SYNC_MAX_INTERVAL_MS);
  }

  /**
   * Update drift measurement and prediction
   * @param {number} drift - Measured drift in milliseconds
   */
  updateDrift(drift) {
    this.lastDrift = drift;
    
    // Store drift history for prediction
    this.driftHistory.push({ time: Date.now(), drift });
    if (this.driftHistory.length > 20) {
      this.driftHistory.shift();
    }

    // Calculate predicted drift using linear regression
    if (this.driftHistory.length >= 3) {
      this.predictedDrift = this.calculatePredictedDrift();
    }
  }

  /**
   * Calculate predicted drift using simple linear regression
   * @returns {number} Predicted drift in milliseconds
   */
  calculatePredictedDrift() {
    const n = this.driftHistory.length;
    if (n < 3) return this.lastDrift;

    // Simple moving average with recent samples weighted more
    let weightedSum = 0;
    let weightSum = 0;
    for (let i = 0; i < n; i++) {
      const weight = (i + 1) / n; // More recent samples have higher weight
      weightedSum += this.driftHistory[i].drift * weight;
      weightSum += weight;
    }

    const avgDrift = weightedSum / weightSum;
    
    // Blend current drift with historical trend
    return this.lastDrift * 0.7 + avgDrift * 0.3;
  }

  /**
   * Calculate drift correction adjustment
   * @returns {number} Adjustment factor for playback rate
   */
  calculateDriftCorrection() {
    if (Math.abs(this.lastDrift) < DRIFT_THRESHOLD_MS) {
      return 0; // No correction needed
    }

    // Use predictive drift for proactive correction
    const driftToCorrect = this.lastDrift * (1 - PREDICTION_FACTOR) + this.predictedDrift * PREDICTION_FACTOR;
    
    // Calculate adjustment: negative drift speeds up, positive drift slows down
    const adjustment = -driftToCorrect * 0.01;
    
    return adjustment;
  }

  /**
   * Update playback rate based on drift correction
   * @param {number} adjustment - Adjustment factor
   */
  updatePlaybackRate(adjustment) {
    const newRate = 1.0 + adjustment;
    this.playbackRate = Math.max(PLAYBACK_RATE_MIN, Math.min(PLAYBACK_RATE_MAX, newRate));
  }
}

// ============================================================
// Track Metadata Structure
// ============================================================

/**
 * Represents metadata for a music track in the sync system
 * 
 * @class TrackInfo
 * @property {string} trackId - Unique identifier for the track
 * @property {number} duration - Track duration in seconds
 * @property {number} startTimestamp - Master clock timestamp when track started (ms)
 * @property {number} startPositionSec - Starting position in track for seek/resume (seconds)
 * @property {string} status - Current playback status ('preparing', 'playing', 'paused', 'stopped')
 */
class TrackInfo {
  /**
   * Create track metadata
   * @param {string} trackId - Unique track identifier
   * @param {number} duration - Track duration in seconds
   * @param {number} startTimestamp - Master clock start timestamp (ms)
   */
  constructor(trackId, duration, startTimestamp) {
    this.trackId = trackId;
    this.duration = duration;          // Track duration in seconds
    this.startTimestamp = startTimestamp; // Master clock start timestamp (ms)
    this.startPositionSec = 0;         // Starting position in track (for seek/resume)
    this.status = 'preparing';         // 'preparing', 'playing', 'paused', 'stopped'
  }
}

// ============================================================
// Sync Engine
// ============================================================

/**
 * High-precision multi-device audio synchronization engine
 * Manages clock synchronization, drift correction, and playback coordination
 * across multiple connected clients
 * 
 * @class SyncEngine
 * @property {Map<string, SyncClient>} clients - Map of client IDs to SyncClient instances
 * @property {TrackInfo|null} currentTrack - Currently playing track metadata
 * @property {Map} p2pNetwork - Session-based P2P network connections
 * @property {Function} masterClock - Master clock function (returns current time in ms)
 */
class SyncEngine {
  /**
   * Create a new sync engine instance
   */
  constructor() {
    this.clients = new Map();        // clientId -> SyncClient
    this.currentTrack = null;        // Current playing track (TrackInfo)
    this.p2pNetwork = new Map();     // Session-based P2P connections
    this.masterClock = () => Date.now(); // Master clock function
  }

  /**
   * Add a new client to the sync engine
   * @param {WebSocket} ws - WebSocket connection
   * @param {string} clientId - Unique client identifier
   * @returns {SyncClient} Created sync client
   */
  addClient(ws, clientId) {
    const client = new SyncClient(ws, clientId);
    this.clients.set(clientId, client);
    return client;
  }

  /**
   * Remove a client from the sync engine
   * @param {string} clientId - Client identifier
   */
  removeClient(clientId) {
    this.clients.delete(clientId);
  }

  /**
   * Get a client by ID
   * @param {string} clientId - Client identifier
   * @returns {SyncClient|null}
   */
  getClient(clientId) {
    return this.clients.get(clientId) || null;
  }

  /**
   * Handle clock sync ping from client
   * @param {string} clientId - Client identifier
   * @param {number} clientNowMs - Client timestamp
   * @returns {object} Pong response data
   */
  handleClockPing(clientId, clientNowMs) {
    const client = this.getClient(clientId);
    if (!client) {
      return null;
    }

    const serverNowMs = this.masterClock();
    
    return {
      t: 'TIME_PONG',
      clientSentTime: clientNowMs,
      serverNowMs: serverNowMs,
      clientId: clientId
    };
  }

  /**
   * Process clock sync pong response on client side
   * @param {string} clientId - Client identifier
   * @param {number} sentTime - Original client timestamp when ping was sent
   * @param {number} serverNowMs - Server timestamp from pong
   */
  processClockPong(clientId, sentTime, serverNowMs) {
    const client = this.getClient(clientId);
    if (!client) return;

    const receivedTime = this.masterClock();
    client.updateClockSync(sentTime, serverNowMs, receivedTime);
  }

  /**
   * Handle playback position feedback from client
   * @param {string} clientId - Client identifier
   * @param {number} position - Current playback position (seconds)
   * @param {number} trackStart - Track start timestamp (ms)
   * @returns {object|null} Drift correction if needed
   */
  handlePlaybackFeedback(clientId, position, trackStart) {
    const client = this.getClient(clientId);
    if (!client || !this.currentTrack) {
      return null;
    }

    client.playbackPosition = position;
    client.lastFeedbackTime = this.masterClock();

    // Calculate drift: actual position vs. expected position
    const elapsedMs = this.masterClock() - trackStart;
    const expectedPosition = (elapsedMs / 1000) + (this.currentTrack.startPositionSec || 0);
    const drift = (position - expectedPosition) * 1000; // Convert to ms

    // Update client drift
    client.updateDrift(drift);

    // Calculate correction adjustment
    const adjustment = client.calculateDriftCorrection();
    client.updatePlaybackRate(adjustment);

    // Return correction if significant
    if (Math.abs(drift) > DRIFT_THRESHOLD_MS) {
      return {
        t: 'DRIFT_CORRECTION',
        adjustment: adjustment,
        drift: drift,
        playbackRate: client.playbackRate,
        predictedDrift: client.predictedDrift
      };
    }

    return null;
  }

  /**
   * Broadcast track with precise timestamp
   * @param {string} trackId - Track identifier
   * @param {number} duration - Track duration in seconds
   * @param {number} startDelay - Delay before playback starts (ms)
   * @param {object} additionalData - Additional track data (url, title, etc.)
   * @returns {object} Broadcast message
   */
  broadcastTrack(trackId, duration, startDelay = DEFAULT_START_DELAY_MS, additionalData = {}) {
    const masterTimestamp = this.masterClock();
    const playAt = masterTimestamp + startDelay;

    this.currentTrack = new TrackInfo(trackId, duration, playAt);
    Object.assign(this.currentTrack, additionalData);

    const broadcast = {
      t: 'PLAY_TRACK',
      trackId: trackId,
      playAt: playAt,
      duration: duration,
      startDelay: startDelay,
      ...additionalData
    };

    // Add per-client clock offset for accurate scheduling
    const clientBroadcasts = new Map();
    this.clients.forEach((client, clientId) => {
      clientBroadcasts.set(clientId, {
        ...broadcast,
        clockOffset: client.clockOffset,
        playAtClient: playAt - client.clockOffset
      });
    });

    return { broadcast, clientBroadcasts };
  }

  /**
   * Get sync statistics for monitoring
   * @returns {object} Sync statistics
   */
  getSyncStats() {
    const stats = {
      totalClients: this.clients.size,
      clients: []
    };

    this.clients.forEach((client, clientId) => {
      stats.clients.push({
        clientId: clientId,
        clockOffset: client.clockOffset,
        latency: client.latency,
        lastDrift: client.lastDrift,
        predictedDrift: client.predictedDrift,
        networkStability: client.networkStability,
        playbackRate: client.playbackRate,
        playbackPosition: client.playbackPosition
      });
    });

    return stats;
  }

  /**
   * Detect clients with significant desync
   * @returns {Array} Array of desynced client IDs
   */
  getDesyncedClients() {
    const desynced = [];
    
    this.clients.forEach((client, clientId) => {
      if (Math.abs(client.lastDrift) > DESYNC_THRESHOLD_MS) {
        desynced.push({
          clientId: clientId,
          drift: client.lastDrift,
          severity: Math.abs(client.lastDrift) > 200 ? 'critical' : 'warning'
        });
      }
    });

    return desynced;
  }

  /**
   * Calculate adaptive lead time based on network conditions (Phase 9)
   * Uses p90 of time_to_ready + jitter margin, clamped to 1500-5000ms
   * @param {number} p90Ms - P90 of time_to_ready from metrics (ms)
   * @returns {number} Calculated lead time in milliseconds
   */
  calculateAdaptiveLeadTime(p90Ms = 0) {
    // Base lead time on p90 of time_to_ready
    let leadTime = p90Ms;
    
    // Add jitter margin (20% of p90, minimum 300ms)
    const jitterMargin = Math.max(300, leadTime * 0.2);
    leadTime += jitterMargin;
    
    // Factor in network stability of connected clients
    let avgNetworkStability = 1.0;
    if (this.clients.size > 0) {
      const totalStability = Array.from(this.clients.values())
        .reduce((sum, client) => sum + client.networkStability, 0);
      avgNetworkStability = totalStability / this.clients.size;
    }
    
    // Adjust for poor network stability (lower stability = higher lead time)
    if (avgNetworkStability < 0.7) {
      const stabilityBoost = (1.0 - avgNetworkStability) * 1000; // Up to 1000ms boost
      leadTime += stabilityBoost;
    }
    
    // Clamp to 1500-5000ms range as specified
    leadTime = Math.max(1500, Math.min(5000, leadTime));
    
    return Math.round(leadTime);
  }
}

// ============================================================
// P2P Network Management (Skeleton)
// ============================================================

class P2PNetwork {
  constructor() {
    this.peers = new Map();          // peerId -> peer connection info
    this.sessions = new Map();       // sessionId -> Set of peerIds
  }

  /**
   * Discover peers for a session
   * @param {string} sessionId - Session identifier
   * @returns {Array} Available peer IDs
   */
  discoverPeers(sessionId) {
    const peers = this.sessions.get(sessionId);
    return peers ? Array.from(peers) : [];
  }

  /**
   * Add peer to session
   * @param {string} sessionId - Session identifier
   * @param {string} peerId - Peer identifier
   */
  addPeerToSession(sessionId, peerId) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId).add(peerId);
    
    this.peers.set(peerId, {
      sessionId: sessionId,
      latency: 0,
      lastSeen: Date.now(),
      status: 'connected'
    });
  }

  /**
   * Remove peer from session
   * @param {string} sessionId - Session identifier
   * @param {string} peerId - Peer identifier
   */
  removePeerFromSession(sessionId, peerId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.delete(peerId);
      if (session.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
    this.peers.delete(peerId);
  }

  /**
   * Select optimal peer based on latency
   * @param {string} sessionId - Session identifier
   * @returns {string|null} Optimal peer ID
   */
  selectOptimalPeer(sessionId) {
    const peers = this.discoverPeers(sessionId);
    if (peers.length === 0) return null;

    // Select peer with lowest latency
    let optimalPeer = peers[0];
    let minLatency = this.peers.get(optimalPeer)?.latency || Infinity;

    peers.forEach(peerId => {
      const peer = this.peers.get(peerId);
      if (peer && peer.latency < minLatency) {
        minLatency = peer.latency;
        optimalPeer = peerId;
      }
    });

    return optimalPeer;
  }
}

// ============================================================
// Exports
// ============================================================

module.exports = {
  SyncEngine,
  SyncClient,
  TrackInfo,
  P2PNetwork
};
