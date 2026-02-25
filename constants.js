/**
 * Application Constants
 * Centralized configuration values and magic numbers
 * Reference: IMPROVEMENT_SUGGESTIONS.md Section 3.2
 */

// ============================================================================
// SYNC & DRIFT CORRECTION THRESHOLDS
// ============================================================================

export const SYNC_THRESHOLDS = {
  // Drift tolerance levels (milliseconds)
  IGNORE_DRIFT_MS: 200,           // <200ms: Ignored (normal variance)
  SOFT_CORRECTION_MS: 800,        // 200-800ms: Soft seek (gradual adjustment)
  MODERATE_CORRECTION_MS: 1000,   // 800-1000ms: Moderate seek
  HARD_CORRECTION_MS: 1500,       // >1000ms: Hard seek (immediate correction)
  
  // Mobile-specific thresholds (looser to account for network jitter)
  MOBILE_IGNORE_DRIFT_MS: 300,    // <300ms: Ignored on mobile (higher jitter)
  MOBILE_SOFT_CORRECTION_MS: 1000, // 300-1000ms: Soft correction on mobile
  
  // Manual sync button display threshold
  SHOW_MANUAL_SYNC_MS: 1500,      // Show manual sync button when drift >1500ms
  CORRECTION_FAILURE_THRESHOLD: 3, // Show manual sync after 3 failed corrections
  
  // Sync check interval
  CHECK_INTERVAL_MS: 2000,        // Check drift every 2 seconds
};

// ============================================================================
// BUFFER & PREDICTION
// ============================================================================

export const BUFFER = {
  SIZE_MS: 150,                   // Audio buffer size
  MAX_PREDICTIONS: 10,            // Maximum number of drift predictions to keep
  PRELOAD_THRESHOLD_MS: 500,      // Start preloading when this close to next track
};

// ============================================================================
// RETRY & BACKOFF
// ============================================================================

export const RETRY = {
  INITIAL_DELAY_MS: 2000,         // Initial retry delay
  MAX_ATTEMPTS: 3,                // Maximum retry attempts
  BACKOFF_MULTIPLIER: 1.5,        // Exponential backoff multiplier
  TIMEOUT_MS: 5000,               // Request timeout
};

// ============================================================================
// WEBSOCKET & NETWORK
// ============================================================================

export const WEBSOCKET = {
  RECONNECT_DELAY_MS: 1000,       // Delay before reconnecting
  RECONNECT_MAX_DELAY_MS: 30000,  // Maximum reconnect delay
  PING_INTERVAL_MS: 30000,        // Heartbeat ping interval
  PONG_TIMEOUT_MS: 5000,          // Timeout waiting for pong response
  MAX_MESSAGE_SIZE_BYTES: 1048576, // 1MB max message size
  
  // Network type thresholds
  NETWORK_TYPES: {
    WIFI: 'wifi',
    CELLULAR: 'cellular',
    UNKNOWN: 'unknown'
  }
};

// ============================================================================
// CROWD ENERGY & SCORING
// ============================================================================

export const CROWD_ENERGY = {
  MAX_ENERGY: 100,                // Maximum crowd energy level
  EMOJI_BOOST: 5,                 // Energy increase per emoji reaction
  MESSAGE_BOOST: 8,               // Energy increase per text message
  DECAY_RATE: 0.1,                // Energy decay rate per second (if implemented)
  THRESHOLD_LOW: 30,              // Low energy threshold
  THRESHOLD_MEDIUM: 60,           // Medium energy threshold
  THRESHOLD_HIGH: 80,             // High energy threshold
};

export const SCORING = {
  POINTS_PER_EMOJI: 1,            // Guest points per emoji sent
  POINTS_PER_MESSAGE: 2,          // Guest points per message sent
  POINTS_PER_MINUTE: 1,           // Guest points per minute in party
  DJ_BASE_SCORE: 10,              // Base DJ score per party
  DJ_GUEST_MULTIPLIER: 5,         // DJ score per guest
};

// ============================================================================
// RATE LIMITING
// ============================================================================

export const RATE_LIMITS = {
  AUTH: {
    WINDOW_MS: 15 * 60 * 1000,    // 15 minutes
    MAX_REQUESTS: 10,             // Allow for typos
  },
  API: {
    WINDOW_MS: 60 * 1000,         // 1 minute
    MAX_REQUESTS: 30,
  },
  PURCHASE: {
    WINDOW_MS: 60 * 1000,         // 1 minute
    MAX_REQUESTS: 10,
  },
  MESSAGING: {
    GUEST_WINDOW_MS: 10000,       // 10 seconds
    GUEST_MAX_MESSAGES: 5,
    DJ_WINDOW_MS: 5000,           // 5 seconds
    DJ_MAX_MESSAGES: 10,
  },
};

// ============================================================================
// PARTY & SESSION
// ============================================================================

export const PARTY = {
  CODE_LENGTH: 6,                 // Party code length
  DEFAULT_DURATION_HOURS: 2,      // Default party duration
  MAX_GUESTS: 50,                 // Maximum guests per party (can be extended)
  IDLE_TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes idle timeout
  CLEANUP_INTERVAL_MS: 60 * 1000, // Cleanup check every minute
};

// ============================================================================
// AUDIO & PLAYBACK
// ============================================================================

export const AUDIO = {
  DEFAULT_VOLUME: 0.7,            // Default volume (70%)
  FADE_DURATION_MS: 300,          // Audio fade duration
  CROSSFADE_DURATION_MS: 500,     // Crossfade between tracks
  MIN_VOLUME: 0.0,
  MAX_VOLUME: 1.0,
};

// ============================================================================
// UI & ANIMATION
// ============================================================================

export const UI = {
  TOAST_DURATION_MS: 3000,        // Toast notification duration
  MODAL_ANIMATION_MS: 200,        // Modal open/close animation
  REACTION_POPUP_MS: 2000,        // Reaction popup display time
  NOTIFICATION_TIMEOUT_MS: 5000,  // General notification timeout
  DEBOUNCE_DELAY_MS: 300,         // Input debounce delay
};

// ============================================================================
// STORAGE & CACHE
// ============================================================================

export const STORAGE = {
  NAMESPACE: 'phoneparty',        // localStorage namespace prefix
  SESSION_TTL_MS: 24 * 60 * 60 * 1000, // 24 hours
  CACHE_VERSION: 1,               // Increment to invalidate old cache
};

// ============================================================================
// VALIDATION
// ============================================================================

export const VALIDATION = {
  MIN_PASSWORD_LENGTH: 8,
  MAX_PASSWORD_LENGTH: 128,
  MIN_DJ_NAME_LENGTH: 2,
  MAX_DJ_NAME_LENGTH: 30,
  MIN_MESSAGE_LENGTH: 1,
  MAX_MESSAGE_LENGTH: 200,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

// ============================================================================
// TIER LIMITS
// ============================================================================

export const TIER_LIMITS = {
  PROTOTYPE: {
    MAX_GUESTS: 5,
    MAX_QUEUE: 10,
    PARTY_DURATION_HOURS: 1,
    FEATURES: {
      CHAT: true,
      REACTIONS: true,
      VISUALIZER: false,
      CUSTOM_THEMES: false,
    },
  },
  FREE: {
    MAX_GUESTS: 10,
    MAX_QUEUE: 20,
    PARTY_DURATION_HOURS: 2,
    FEATURES: {
      CHAT: true,
      REACTIONS: true,
      VISUALIZER: true,
      CUSTOM_THEMES: false,
    },
  },
  PRO: {
    MAX_GUESTS: 50,
    MAX_QUEUE: 100,
    PARTY_DURATION_HOURS: 8,
    FEATURES: {
      CHAT: true,
      REACTIONS: true,
      VISUALIZER: true,
      CUSTOM_THEMES: true,
    },
  },
};

// ============================================================================
// MESSAGE PRIORITIES (Event Replay System)
// ============================================================================

export const MESSAGE_PRIORITY = {
  CRITICAL: 'CRITICAL',    // Playback sync, party state changes
  HIGH: 'HIGH',            // User join/leave, important updates
  NORMAL: 'NORMAL',        // UI updates, non-critical messages
};

// ============================================================================
// CLOCK SYNC (NTP-like)
// ============================================================================

export const CLOCK_SYNC = {
  SAMPLE_COUNT: 8,                // Number of samples for clock offset calculation
  SAMPLE_INTERVAL_MS: 500,        // Interval between samples
  RESYNC_INTERVAL_MS: 60000,      // Resync clock every minute
  MAX_RTT_MS: 200,                // Discard samples with RTT > 200ms
  OUTLIER_THRESHOLD: 2,           // Standard deviations for outlier detection
};

// Export all as default for convenience
export default {
  SYNC_THRESHOLDS,
  BUFFER,
  RETRY,
  WEBSOCKET,
  CROWD_ENERGY,
  SCORING,
  RATE_LIMITS,
  PARTY,
  AUDIO,
  UI,
  STORAGE,
  VALIDATION,
  TIER_LIMITS,
  MESSAGE_PRIORITY,
  CLOCK_SYNC,
};
