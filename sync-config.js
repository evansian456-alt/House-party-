/**
 * SyncSpeaker Synchronization Configuration
 * 
 * Centralized configuration for sync engine and client.
 * Contains all timing, threshold, and performance constants used
 * across the synchronization system.
 * 
 * This configuration enables fine-tuning of sync behavior without
 * modifying core logic, and provides a single source of truth for
 * all synchronization parameters.
 * 
 * @module sync-config
 */

// ============================================================
// Clock Synchronization Constants
// ============================================================

const CLOCK_SYNC_INTERVAL_MS = 5000;        // Base interval for clock sync (5s)
const CLOCK_SYNC_MIN_INTERVAL_MS = 3000;    // Minimum sync interval (3s)
const CLOCK_SYNC_MAX_INTERVAL_MS = 7000;    // Maximum sync interval (7s)

// ============================================================
// Playback and Feedback Constants
// ============================================================

const PLAYBACK_FEEDBACK_INTERVAL_MS = 100;  // Client sends position every 100ms
const DRIFT_CORRECTION_INTERVAL_MS = 200;   // Server checks drift every 200ms
const ROLLING_BUFFER_MS = 150;              // Rolling buffer size (100-200ms)
const DEFAULT_START_DELAY_MS = 3000;        // Default delay before playback starts
const LATE_PLAYBACK_THRESHOLD_MS = -1000;   // Threshold for "too late" playback (1 second)

// ============================================================
// Playback Rate Adjustment Constants
// ============================================================

const PLAYBACK_RATE_MIN = 0.95;             // Minimum playback rate
const PLAYBACK_RATE_MAX = 1.05;             // Maximum playback rate

// ============================================================
// Drift Detection and Correction Constants
// ============================================================

const DRIFT_THRESHOLD_MS = 50;              // Ignore drift below 50ms (server-side)
const DESYNC_THRESHOLD_MS = 50;             // Resync if desync exceeds 50ms
const PREDICTION_FACTOR = 0.8;              // Predictive drift factor (0-1)

// Desktop sync thresholds
const DESKTOP_IGNORE_DRIFT_MS = 200;        // Ignore drift below 200ms on desktop
const DESKTOP_SOFT_CORRECTION_MS = 800;     // Soft correction threshold on desktop

// Mobile-optimized thresholds (looser for cellular networks)
const MOBILE_IGNORE_DRIFT_MS = 300;         // Ignore drift below 300ms on mobile
const MOBILE_SOFT_CORRECTION_MS = 1000;     // Soft correction threshold on mobile

// ============================================================
// Network Stability Constants
// ============================================================

const NETWORK_STABILITY_SAMPLES = 10;       // Sample count for network stability
const NETWORK_STABILITY_NORMALIZATION_FACTOR = 100; // Normalization factor for stability calculation

// ============================================================
// WebSocket Reconnection Constants
// ============================================================

const MAX_RECONNECT_ATTEMPTS = 10;          // Maximum reconnection attempts
const RECONNECT_DELAY_MS = 1000;            // Initial reconnection delay (ms)
const MAX_RECONNECT_DELAY_MS = 30000;       // Maximum reconnection delay (30s)

// ============================================================
// Exports
// ============================================================

module.exports = {
  // Clock sync
  CLOCK_SYNC_INTERVAL_MS,
  CLOCK_SYNC_MIN_INTERVAL_MS,
  CLOCK_SYNC_MAX_INTERVAL_MS,
  
  // Playback and feedback
  PLAYBACK_FEEDBACK_INTERVAL_MS,
  DRIFT_CORRECTION_INTERVAL_MS,
  ROLLING_BUFFER_MS,
  DEFAULT_START_DELAY_MS,
  LATE_PLAYBACK_THRESHOLD_MS,
  
  // Playback rate
  PLAYBACK_RATE_MIN,
  PLAYBACK_RATE_MAX,
  
  // Drift detection
  DRIFT_THRESHOLD_MS,
  DESYNC_THRESHOLD_MS,
  PREDICTION_FACTOR,
  DESKTOP_IGNORE_DRIFT_MS,
  DESKTOP_SOFT_CORRECTION_MS,
  MOBILE_IGNORE_DRIFT_MS,
  MOBILE_SOFT_CORRECTION_MS,
  
  // Network stability
  NETWORK_STABILITY_SAMPLES,
  NETWORK_STABILITY_NORMALIZATION_FACTOR,
  
  // WebSocket reconnection
  MAX_RECONNECT_ATTEMPTS,
  RECONNECT_DELAY_MS,
  MAX_RECONNECT_DELAY_MS
};
