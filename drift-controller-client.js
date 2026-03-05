/**
 * Drift Controller Module (Client-Side)
 * 
 * Implements continuous drift correction for perfect audio synchronization.
 * 
 * Features:
 * - Multi-threshold drift correction strategy
 * - Soft correction using playbackRate (smooth adjustment)
 * - Hard correction using seek (for large drift)
 * - Automatic monitoring every 2-5 seconds
 * - Mobile/background recovery
 * - Psychoacoustic masking (micro-fade on seek, transient guard, rate nudge)
 * 
 * Thresholds:
 * - < 100ms: Ignore (acceptable sync)
 * - 100ms-800ms: Soft correction (playbackRate 0.98-1.02)
 * - > 1000ms: Hard correction (seek to correct position)
 * 
 * Architecture:
 * - Continuously monitors drift relative to server time
 * - Applies gradual corrections to avoid jarring playback changes
 * - Returns to normal playbackRate once synced
 */

// Load psychoacoustic masking helpers (browser: attached to window; Node: required)
const _PsychoacousticMasking = (typeof PsychoacousticMasking !== 'undefined')
  ? PsychoacousticMasking
  : (() => {
    try { return require('./psychoacoustic-masking').PsychoacousticMasking; } catch (_) { return null; }
  })();

class DriftController {
  constructor(audioElement, timeSync) {
    this.audioElement = audioElement;
    this.timeSync = timeSync;
    
    // Drift monitoring state
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.monitorIntervalMs = 2000; // Check every 2 seconds
    
    // Track playback state
    this.trackStartServerMs = 0;
    this.trackStartPositionSec = 0;
    this.isPlaying = false;

    // Psychoacoustic masking: wall-clock time when the current track started
    // (used by the transient guard to avoid corrections in the first 300ms)
    this.trackStartWallMs = 0;
    
    // Drift history for analysis
    this.driftHistory = []; // Array of { timestamp, driftMs, correctionType }
    this.maxHistorySize = 30; // Keep last 30 samples (1 minute at 2s intervals)
    
    // Correction state
    this.correctionInProgress = false;
    this.lastCorrectionTime = 0;
    this.lastCorrectionType = null;
    
    // Thresholds (in seconds)
    this.thresholds = {
      ignore: 0.1,           // < 100ms: ignore
      softCorrection: 0.8,   // 100ms-800ms: soft correction
      hardCorrection: 1.0    // > 1s: hard correction (seek)
    };
    
    // Playback rate adjustment
    this.playbackRateConfig = {
      normal: 1.0,
      fast: 1.02,     // 2% faster to catch up
      slow: 0.98,     // 2% slower to slow down
      maxDeviation: 0.05  // Don't go beyond ±5%
    };
    
    // Metrics
    this.metrics = {
      totalChecks: 0,
      softCorrections: 0,
      hardCorrections: 0,
      avgDriftMs: 0,
      maxDriftMs: 0,
      lastDriftMs: 0,
      correctionSuccessRate: 0
    };
    
    // Debug mode
    this.debug = localStorage.getItem('DEBUG_DRIFT') === 'true' || 
                 process.env.DEBUG === 'true';
    
    // Callbacks
    this.onDriftDetected = null; // callback(driftMs, correctionType)
    this.onCorrectionApplied = null; // callback(correctionType, success)
  }
  
  /**
   * Start monitoring drift for a track
   * @param {number} startServerMs - Server timestamp when track started
   * @param {number} startPositionSec - Starting position in track (for resume)
   */
  startMonitoring(startServerMs, startPositionSec = 0) {
    this.trackStartServerMs = startServerMs;
    this.trackStartPositionSec = startPositionSec;
    this.isPlaying = true;
    this.trackStartWallMs = Date.now(); // record wall-clock start for transient guard
    
    if (this.isMonitoring) {
      if (this.debug) {
        console.log('[DriftController] Already monitoring, updating track info');
      }
      return;
    }
    
    this.isMonitoring = true;
    this.driftHistory = [];
    
    this.monitorInterval = setInterval(() => {
      this._checkDrift();
    }, this.monitorIntervalMs);
    
    if (this.debug) {
      console.log('[DriftController] Started monitoring:', {
        startServerMs,
        startPositionSec
      });
    }
  }
  
  /**
   * Stop monitoring drift
   */
  stopMonitoring() {
    this.isPlaying = false;
    
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    
    this.isMonitoring = false;
    
    // Reset playback rate to normal
    if (this.audioElement && this.audioElement.playbackRate !== this.playbackRateConfig.normal) {
      this.audioElement.playbackRate = this.playbackRateConfig.normal;
    }
    
    if (this.debug) {
      console.log('[DriftController] Stopped monitoring');
    }
  }
  
  /**
   * Check current drift and apply correction if needed
   * @private
   */
  _checkDrift() {
    if (!this.audioElement || !this.isPlaying) {
      return;
    }

    // Technique 3 — Transient-Aware Resync:
    // Skip corrections during the first 300ms of playback (musical attack period).
    if (
      _PsychoacousticMasking &&
      _PsychoacousticMasking.isInTransientPeriod(this.trackStartWallMs)
    ) {
      if (this.debug) {
        console.log('[DriftController] Skipping correction — transient guard active');
      }
      return;
    }

    this.metrics.totalChecks++;
    
    // Calculate expected position based on server time
    const nowServerMs = this.timeSync.now();
    const elapsedSec = (nowServerMs - this.trackStartServerMs) / 1000;
    const expectedPositionSec = this.trackStartPositionSec + elapsedSec;
    
    // Get actual position
    const actualPositionSec = this.audioElement.currentTime;
    
    // Calculate drift (positive = ahead, negative = behind)
    const driftSec = actualPositionSec - expectedPositionSec;
    const driftMs = driftSec * 1000;
    
    // Update metrics
    this.metrics.lastDriftMs = driftMs;
    this.metrics.maxDriftMs = Math.max(this.metrics.maxDriftMs, Math.abs(driftMs));
    this._updateAvgDrift(driftMs);
    
    // Record in history
    const historyEntry = {
      timestamp: Date.now(),
      driftMs,
      correctionType: null
    };
    
    // Determine correction strategy
    const absDriftSec = Math.abs(driftSec);
    let correctionType = null;
    
    if (absDriftSec < this.thresholds.ignore) {
      // Within acceptable range - no correction needed
      correctionType = 'none';
      
      // Return playback rate to normal if it was adjusted
      if (this.audioElement.playbackRate !== this.playbackRateConfig.normal) {
        this.audioElement.playbackRate = this.playbackRateConfig.normal;
        if (this.debug) {
          console.log('[DriftController] Drift corrected, returning to normal playback rate');
        }
      }
    } else if (absDriftSec < this.thresholds.softCorrection) {
      // Soft correction using playback rate
      correctionType = 'soft';
      this._applySoftCorrection(driftSec);
      this.metrics.softCorrections++;
    } else if (absDriftSec >= this.thresholds.hardCorrection) {
      // Hard correction using seek
      correctionType = 'hard';
      this._applyHardCorrection(expectedPositionSec);
      this.metrics.hardCorrections++;
    }
    
    historyEntry.correctionType = correctionType;
    this.driftHistory.push(historyEntry);
    
    // Trim history
    if (this.driftHistory.length > this.maxHistorySize) {
      this.driftHistory.shift();
    }
    
    // Trigger callbacks
    if (this.onDriftDetected && correctionType !== 'none') {
      this.onDriftDetected(driftMs, correctionType);
    }
    
    if (this.debug && correctionType !== 'none') {
      console.log('[DriftController] Drift detected:', {
        drift: driftMs.toFixed(2) + 'ms',
        expected: expectedPositionSec.toFixed(2) + 's',
        actual: actualPositionSec.toFixed(2) + 's',
        correction: correctionType
      });
    }
  }
  
  /**
   * Apply soft correction using playback rate adjustment
   * @private
   */
  _applySoftCorrection(driftSec) {
    if (!this.audioElement) return;

    const driftMs = driftSec * 1000;

    // Technique 4 — Micro Playback-Rate Nudge:
    // For very small drift (< 120ms), use a gentle rate nudge rather than a
    // larger rate adjustment, so the correction is imperceptible.
    if (
      _PsychoacousticMasking &&
      _PsychoacousticMasking.applyMicroRateNudge(this.audioElement, driftMs)
    ) {
      this.lastCorrectionType = 'soft';
      this.lastCorrectionTime = Date.now();
      if (this.debug) {
        console.log('[DriftController] Micro rate nudge applied:', {
          drift: driftMs.toFixed(2) + 'ms',
        });
      }
      if (this.onCorrectionApplied) this.onCorrectionApplied('soft', true);
      return;
    }

    // Fallback: standard playback-rate correction for larger soft-range drift
    // If ahead, slow down; if behind, speed up
    let targetRate = driftSec > 0
      ? this.playbackRateConfig.slow   // ahead: slow down
      : this.playbackRateConfig.fast;  // behind: speed up
    
    // Clamp to maximum deviation
    const normal = this.playbackRateConfig.normal;
    const maxDev = this.playbackRateConfig.maxDeviation;
    targetRate = Math.max(normal - maxDev, Math.min(normal + maxDev, targetRate));
    
    // Only update if significantly different
    if (Math.abs(this.audioElement.playbackRate - targetRate) > 0.001) {
      this.audioElement.playbackRate = targetRate;
      this.lastCorrectionType = 'soft';
      this.lastCorrectionTime = Date.now();
      
      if (this.debug) {
        console.log('[DriftController] Soft correction:', {
          drift: (driftSec * 1000).toFixed(2) + 'ms',
          rate: targetRate.toFixed(3)
        });
      }
      
      if (this.onCorrectionApplied) {
        this.onCorrectionApplied('soft', true);
      }
    }
  }
  
  /**
   * Apply hard correction using seek
   * @private
   */
  _applyHardCorrection(expectedPositionSec) {
    if (!this.audioElement) return;
    
    // Avoid correcting too frequently
    const timeSinceLastCorrection = Date.now() - this.lastCorrectionTime;
    if (timeSinceLastCorrection < 5000 && this.lastCorrectionType === 'hard') {
      if (this.debug) {
        console.log('[DriftController] Skipping hard correction - too soon since last');
      }
      return;
    }

    const beforeSec = this.audioElement.currentTime;
    this.lastCorrectionType = 'hard';
    this.lastCorrectionTime = Date.now();

    if (this.debug) {
      console.log('[DriftController] Hard correction (micro-fade):', {
        from: beforeSec.toFixed(2) + 's',
        to: expectedPositionSec.toFixed(2) + 's',
        jump: ((expectedPositionSec - beforeSec) * 1000).toFixed(2) + 'ms',
      });
    }

    // Technique 2 — Micro-Fade During Seek Correction:
    // Briefly reduce volume, seek, then restore — prevents audible pop artifacts.
    if (_PsychoacousticMasking) {
      _PsychoacousticMasking.seekWithMicroFade(
        this.audioElement,
        expectedPositionSec,
        {
          onComplete: () => {
            // Reset playback rate to normal after the fade cycle completes
            this.audioElement.playbackRate = this.playbackRateConfig.normal;
            if (this.onCorrectionApplied) this.onCorrectionApplied('hard', true);
          },
        }
      );
    } else {
      // Fallback: plain seek without fade
      try {
        this.audioElement.currentTime = expectedPositionSec;
        this.audioElement.playbackRate = this.playbackRateConfig.normal;
        if (this.onCorrectionApplied) this.onCorrectionApplied('hard', true);
      } catch (err) {
        console.error('[DriftController] Hard correction failed:', err);
        if (this.onCorrectionApplied) this.onCorrectionApplied('hard', false);
      }
    }
  }
  
  /**
   * Update average drift using EWMA
   * @private
   */
  _updateAvgDrift(driftMs) {
    if (this.metrics.avgDriftMs === 0) {
      this.metrics.avgDriftMs = Math.abs(driftMs);
    } else {
      this.metrics.avgDriftMs = 0.9 * this.metrics.avgDriftMs + 0.1 * Math.abs(driftMs);
    }
  }
  
  /**
   * Force an immediate drift check and correction
   */
  forceCheck() {
    if (this.isPlaying) {
      this._checkDrift();
    }
  }
  
  /**
   * Get current metrics
   * @returns {Object} Drift metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      isMonitoring: this.isMonitoring,
      historySize: this.driftHistory.length,
      currentPlaybackRate: this.audioElement ? this.audioElement.playbackRate : 1.0
    };
  }
  
  /**
   * Get drift history for analysis
   * @returns {Array} Drift history
   */
  getHistory() {
    return this.driftHistory.slice();
  }
  
  /**
   * Reset all metrics and state
   */
  reset() {
    this.stopMonitoring();
    this.driftHistory = [];
    this.metrics = {
      totalChecks: 0,
      softCorrections: 0,
      hardCorrections: 0,
      avgDriftMs: 0,
      maxDriftMs: 0,
      lastDriftMs: 0,
      correctionSuccessRate: 0
    };
  }
}

if (typeof window !== 'undefined') {
  window.DriftController = DriftController;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DriftController };
}
