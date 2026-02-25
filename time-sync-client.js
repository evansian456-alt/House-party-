/**
 * Time Synchronization Module (Client-Side)
 * 
 * Implements NTP-style clock synchronization for accurate time authority.
 * 
 * Features:
 * - Multi-sample clock sync with RTT filtering
 * - Exponentially weighted moving average (EWMA) for stability
 * - Automatic periodic resync
 * - Quality metrics and monitoring
 * 
 * Architecture:
 * - On connect: Perform initial multi-sample sync (5 samples)
 * - During session: Periodic resync every 30 seconds
 * - Quality tracking: Monitor offset drift and RTT
 */

class TimeSync {
  constructor() {
    // Server clock offset: serverTime = localTime + offset
    this.serverOffsetMs = 0;
    
    // Sync state
    this.isInitialized = false;
    this.syncInProgress = false;
    this.lastSyncTime = 0;
    
    // Sample tracking for multi-sample sync
    this.sampleCount = 0;
    this.targetSamples = 5; // Number of samples for initial sync
    this.samples = []; // Array of { offset, rtt, timestamp }
    
    // Pending ping tracking
    this.pendingPings = new Map(); // pingId -> { clientSendMs, callback }
    this.pingIdCounter = 0;
    
    // Resync interval
    this.resyncInterval = null;
    this.resyncIntervalMs = 30000; // 30 seconds
    
    // Quality metrics
    this.metrics = {
      totalSyncs: 0,
      failedSyncs: 0,
      avgRtt: 0,
      maxRtt: 0,
      minRtt: Infinity,
      offsetStdDev: 0,
      lastSyncQuality: 'unknown' // excellent, good, fair, poor
    };
    
    // Configuration
    this.config = {
      maxRttMs: 800,           // Reject samples with RTT > 800ms
      excellentRttMs: 100,     // RTT < 100ms = excellent
      goodRttMs: 200,          // RTT < 200ms = good
      fairRttMs: 400,          // RTT < 400ms = fair
      ewmaAlpha: 0.2,          // Weight for new samples (0-1)
      minSamplesForInit: 3     // Minimum successful samples for initialization
    };
    
    // Debug mode
    this.debug = localStorage.getItem('DEBUG_TIME_SYNC') === 'true';
  }
  
  /**
   * Get current server time using synchronized offset
   * @returns {number} Server timestamp in milliseconds
   */
  now() {
    return Date.now() + this.serverOffsetMs;
  }
  
  /**
   * Start initial multi-sample synchronization
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Promise<boolean>} Success status
   */
  async initialize(ws) {
    if (this.syncInProgress) {
      console.warn('[TimeSync] Sync already in progress');
      return false;
    }
    
    if (this.debug) {
      console.log('[TimeSync] Starting initial synchronization...');
    }
    
    this.syncInProgress = true;
    this.samples = [];
    this.sampleCount = 0;
    
    return new Promise((resolve) => {
      const sampleInterval = setInterval(() => {
        if (this.sampleCount >= this.targetSamples) {
          clearInterval(sampleInterval);
          this.syncInProgress = false;
          
          const success = this._processSamples();
          if (success) {
            this.isInitialized = true;
            this.lastSyncTime = Date.now();
            this._startPeriodicResync(ws);
            
            if (this.debug) {
              console.log('[TimeSync] Initialization complete:', {
                offset: this.serverOffsetMs.toFixed(2),
                samples: this.samples.length,
                quality: this.metrics.lastSyncQuality
              });
            }
          }
          
          resolve(success);
          return;
        }
        
        // Send TIME_PING
        this._sendPing(ws, (success, offset, rtt) => {
          if (success) {
            this.sampleCount++;
          }
        });
      }, 200); // 200ms between samples
    });
  }
  
  /**
   * Perform a single synchronization sample
   * @param {WebSocket} ws - WebSocket connection
   * @returns {Promise<boolean>} Success status
   */
  async sync(ws) {
    return new Promise((resolve) => {
      this._sendPing(ws, (success, offset, rtt) => {
        if (success) {
          this.lastSyncTime = Date.now();
          this.metrics.totalSyncs++;
        } else {
          this.metrics.failedSyncs++;
        }
        resolve(success);
      });
    });
  }
  
  /**
   * Send a TIME_PING to the server
   * @private
   */
  _sendPing(ws, callback) {
    const pingId = this.pingIdCounter++;
    const clientSendMs = Date.now();
    
    this.pendingPings.set(pingId, {
      clientSendMs,
      callback
    });
    
    // Timeout for this ping
    setTimeout(() => {
      if (this.pendingPings.has(pingId)) {
        this.pendingPings.delete(pingId);
        callback(false);
        if (this.debug) {
          console.warn('[TimeSync] Ping timeout:', pingId);
        }
      }
    }, 5000); // 5 second timeout
    
    const msg = {
      t: 'TIME_PING',
      clientNowMs: clientSendMs,
      pingId
    };
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      this.pendingPings.delete(pingId);
      callback(false);
    }
  }
  
  /**
   * Handle TIME_PONG response from server
   * @param {Object} msg - TIME_PONG message
   */
  handlePong(msg) {
    const clientReceiveMs = Date.now();
    
    const pingData = this.pendingPings.get(msg.pingId);
    if (!pingData) {
      if (this.debug) {
        console.warn('[TimeSync] Unknown ping ID:', msg.pingId);
      }
      return;
    }
    
    this.pendingPings.delete(msg.pingId);
    
    const clientSendMs = pingData.clientSendMs;
    const rttMs = clientReceiveMs - clientSendMs;
    
    // Reject samples with high RTT
    if (rttMs > this.config.maxRttMs) {
      if (this.debug) {
        console.log('[TimeSync] Rejecting sample - RTT too high:', rttMs);
      }
      pingData.callback(false);
      return;
    }
    
    // Calculate offset using midpoint estimation
    // Assumes symmetric network delay
    const estimatedServerNowMs = msg.serverNowMs + (rttMs / 2);
    const offset = estimatedServerNowMs - clientReceiveMs;
    
    // Store sample
    const sample = {
      offset,
      rtt: rttMs,
      timestamp: Date.now()
    };
    
    this.samples.push(sample);
    
    // Keep only recent samples (last 20)
    if (this.samples.length > 20) {
      this.samples.shift();
    }
    
    // Update metrics
    this._updateMetrics(rttMs);
    
    // Apply offset update
    if (!this.isInitialized) {
      // Initial sync: Use new offset directly
      this.serverOffsetMs = offset;
    } else {
      // Ongoing sync: Apply EWMA smoothing
      const alpha = this.config.ewmaAlpha;
      this.serverOffsetMs = (1 - alpha) * this.serverOffsetMs + alpha * offset;
    }
    
    if (this.debug) {
      console.log('[TimeSync] Sample:', {
        offset: offset.toFixed(2),
        smoothed: this.serverOffsetMs.toFixed(2),
        rtt: rttMs.toFixed(2),
        quality: this._getQuality(rttMs)
      });
    }
    
    pingData.callback(true, offset, rttMs);
  }
  
  /**
   * Process collected samples to determine best offset
   * @private
   * @returns {boolean} Success status
   */
  _processSamples() {
    if (this.samples.length < this.config.minSamplesForInit) {
      console.error('[TimeSync] Insufficient samples:', this.samples.length);
      return false;
    }
    
    // Sort samples by RTT (prefer low-latency samples)
    const sortedSamples = this.samples.slice().sort((a, b) => a.rtt - b.rtt);
    
    // Use median of best 60% of samples
    const bestCount = Math.max(1, Math.floor(sortedSamples.length * 0.6));
    const bestSamples = sortedSamples.slice(0, bestCount);
    
    // Calculate median offset
    const offsets = bestSamples.map(s => s.offset).sort((a, b) => a - b);
    const medianIndex = Math.floor(offsets.length / 2);
    const medianOffset = offsets.length % 2 === 0
      ? (offsets[medianIndex - 1] + offsets[medianIndex]) / 2
      : offsets[medianIndex];
    
    this.serverOffsetMs = medianOffset;
    
    // Calculate standard deviation for quality assessment
    const mean = offsets.reduce((sum, o) => sum + o, 0) / offsets.length;
    const variance = offsets.reduce((sum, o) => sum + Math.pow(o - mean, 2), 0) / offsets.length;
    this.metrics.offsetStdDev = Math.sqrt(variance);
    
    // Determine sync quality
    const avgRtt = bestSamples.reduce((sum, s) => sum + s.rtt, 0) / bestSamples.length;
    this.metrics.lastSyncQuality = this._getQuality(avgRtt);
    
    if (this.debug) {
      console.log('[TimeSync] Processed samples:', {
        total: this.samples.length,
        used: bestSamples.length,
        offset: this.serverOffsetMs.toFixed(2),
        stdDev: this.metrics.offsetStdDev.toFixed(2),
        avgRtt: avgRtt.toFixed(2),
        quality: this.metrics.lastSyncQuality
      });
    }
    
    return true;
  }
  
  /**
   * Start periodic resynchronization
   * @private
   */
  _startPeriodicResync(ws) {
    if (this.resyncInterval) {
      clearInterval(this.resyncInterval);
    }
    
    this.resyncInterval = setInterval(() => {
      if (!this.syncInProgress) {
        this.sync(ws);
      }
    }, this.resyncIntervalMs);
    
    if (this.debug) {
      console.log('[TimeSync] Periodic resync started (interval:', this.resyncIntervalMs, 'ms)');
    }
  }
  
  /**
   * Update quality metrics
   * @private
   */
  _updateMetrics(rttMs) {
    this.metrics.maxRtt = Math.max(this.metrics.maxRtt, rttMs);
    this.metrics.minRtt = Math.min(this.metrics.minRtt, rttMs);
    
    // Update average RTT using EWMA
    if (this.metrics.avgRtt === 0) {
      this.metrics.avgRtt = rttMs;
    } else {
      this.metrics.avgRtt = 0.9 * this.metrics.avgRtt + 0.1 * rttMs;
    }
  }
  
  /**
   * Determine sync quality based on RTT
   * @private
   */
  _getQuality(rttMs) {
    if (rttMs < this.config.excellentRttMs) return 'excellent';
    if (rttMs < this.config.goodRttMs) return 'good';
    if (rttMs < this.config.fairRttMs) return 'fair';
    return 'poor';
  }
  
  /**
   * Get current metrics
   * @returns {Object} Sync metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isInitialized: this.isInitialized,
      serverOffsetMs: this.serverOffsetMs,
      lastSyncAgo: Date.now() - this.lastSyncTime,
      sampleCount: this.samples.length
    };
  }
  
  /**
   * Stop periodic resync
   */
  stop() {
    if (this.resyncInterval) {
      clearInterval(this.resyncInterval);
      this.resyncInterval = null;
    }
  }
  
  /**
   * Reset all state
   */
  reset() {
    this.stop();
    this.serverOffsetMs = 0;
    this.isInitialized = false;
    this.syncInProgress = false;
    this.samples = [];
    this.pendingPings.clear();
    this.sampleCount = 0;
  }
}

// Export singleton instance
const timeSync = new TimeSync();
