/**
 * WebSocket Rate Limiter
 * 
 * Prevents abuse of WebSocket connections through rate limiting.
 * Protects against:
 * - Message flooding
 * - Privileged action spam
 * - DoS attacks
 * 
 * Features:
 * - Per-client rate limiting
 * - Per-operation rate limiting
 * - Sliding window algorithm
 * - Automatic cleanup of old entries
 */

const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Rate limit configurations (events per time window)
const RATE_LIMITS = {
  // Global message rate (any message type)
  GLOBAL: {
    maxEvents: 100,
    windowMs: 60000  // 100 messages per minute
  },
  
  // Host privileged operations
  HOST_PLAY: {
    maxEvents: 10,
    windowMs: 60000  // 10 plays per minute
  },
  
  HOST_PAUSE: {
    maxEvents: 10,
    windowMs: 60000
  },
  
  HOST_TRACK_SELECTED: {
    maxEvents: 20,
    windowMs: 60000  // 20 track selections per minute
  },
  
  HOST_TRACK_CHANGED: {
    maxEvents: 20,
    windowMs: 60000
  },
  
  // Guest messaging
  GUEST_MESSAGE: {
    maxEvents: 15,
    windowMs: 60000  // 15 messages per minute
  },
  
  GUEST_QUICK_REPLY: {
    maxEvents: 30,
    windowMs: 60000  // 30 quick replies per minute
  },
  
  // DJ messaging
  DJ_EMOJI: {
    maxEvents: 20,
    windowMs: 60000
  },
  
  DJ_SHORT_MESSAGE: {
    maxEvents: 10,
    windowMs: 60000
  },
  
  HOST_BROADCAST_MESSAGE: {
    maxEvents: 10,
    windowMs: 60000
  },
  
  // Sync feedback (more lenient)
  PLAYBACK_FEEDBACK: {
    maxEvents: 60,
    windowMs: 60000  // 1 per second average
  },
  
  CLOCK_PING: {
    maxEvents: 120,
    windowMs: 60000  // 2 per second average
  },
  
  SYNC_ISSUE: {
    maxEvents: 10,
    windowMs: 60000
  }
};

// Pre-compute the largest window so cleanupOldEntries doesn't recalculate it on every call
const MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMITS).map(l => l.windowMs));

// Storage for rate limit tracking
// Structure: { clientId: { messageType: [timestamp1, timestamp2, ...], GLOBAL: [...] } }
const rateLimitStore = new Map();

// Cleanup interval - remove old entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let cleanupInterval = null;

/**
 * Initialize the rate limiter and start cleanup task
 */
function initRateLimiter() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  cleanupInterval = setInterval(() => {
    cleanupOldEntries();
  }, CLEANUP_INTERVAL_MS);
  
  console.log('[RateLimiter] Initialized with cleanup interval:', CLEANUP_INTERVAL_MS);
}

/**
 * Check if a message should be rate limited
 * 
 * @param {string|number} clientId - Client ID
 * @param {string} messageType - Message type (e.g., 'HOST_PLAY')
 * @returns {Object} { allowed: boolean, retryAfterMs?: number, limit?: Object }
 */
function checkRateLimit(clientId, messageType) {
  if (!clientId) {
    return { allowed: true }; // No client ID, allow (shouldn't happen)
  }

  const now = Date.now();
  
  // Get or create client's rate limit data
  if (!rateLimitStore.has(clientId)) {
    rateLimitStore.set(clientId, {});
  }
  const clientData = rateLimitStore.get(clientId);

  // Check global rate limit first
  const globalCheck = checkLimit(clientData, 'GLOBAL', now, RATE_LIMITS.GLOBAL);
  if (!globalCheck.allowed) {
    logRateLimitExceeded(clientId, 'GLOBAL', globalCheck);
    return globalCheck;
  }

  // Check message-specific rate limit
  const messageLimit = RATE_LIMITS[messageType];
  if (messageLimit) {
    const messageCheck = checkLimit(clientData, messageType, now, messageLimit);
    if (!messageCheck.allowed) {
      logRateLimitExceeded(clientId, messageType, messageCheck);
      return messageCheck;
    }
  }

  // Record this event
  recordEvent(clientData, 'GLOBAL', now);
  if (messageLimit) {
    recordEvent(clientData, messageType, now);
  }

  return { allowed: true };
}

/**
 * Check if a specific limit is exceeded
 * 
 * @param {Object} clientData - Client's rate limit data
 * @param {string} key - Rate limit key (messageType or 'GLOBAL')
 * @param {number} now - Current timestamp
 * @param {Object} limit - Limit configuration { maxEvents, windowMs }
 * @returns {Object} { allowed: boolean, retryAfterMs?: number, limit: Object }
 */
function checkLimit(clientData, key, now, limit) {
  if (!clientData[key]) {
    clientData[key] = [];
  }

  const events = clientData[key];
  const windowStart = now - limit.windowMs;

  // Remove events outside the window
  const recentEvents = events.filter(timestamp => timestamp > windowStart);
  clientData[key] = recentEvents;

  // Check if limit exceeded
  if (recentEvents.length >= limit.maxEvents) {
    // Calculate when the oldest event will expire
    const oldestEvent = recentEvents[0];
    const retryAfterMs = oldestEvent + limit.windowMs - now;

    return {
      allowed: false,
      retryAfterMs: Math.max(0, retryAfterMs),
      limit: {
        maxEvents: limit.maxEvents,
        windowMs: limit.windowMs,
        current: recentEvents.length
      }
    };
  }

  return { allowed: true, limit };
}

/**
 * Record an event for rate limiting
 * 
 * @param {Object} clientData - Client's rate limit data
 * @param {string} key - Rate limit key
 * @param {number} timestamp - Event timestamp
 */
function recordEvent(clientData, key, timestamp) {
  if (!clientData[key]) {
    clientData[key] = [];
  }
  clientData[key].push(timestamp);
}

/**
 * Clean up old entries from rate limit store
 */
function cleanupOldEntries() {
  const now = Date.now();
  const cutoff = now - MAX_WINDOW_MS - 60000; // Add 1 minute buffer

  let removedClients = 0;
  let removedEvents = 0;

  for (const [clientId, clientData] of rateLimitStore.entries()) {
    let hasRecentEvents = false;

    for (const [key, events] of Object.entries(clientData)) {
      // Filter out old events
      const recentEvents = events.filter(timestamp => timestamp > cutoff);
      
      if (recentEvents.length > 0) {
        clientData[key] = recentEvents;
        hasRecentEvents = true;
      } else {
        delete clientData[key];
      }
      
      removedEvents += events.length - recentEvents.length;
    }

    // Remove client if no recent events
    if (!hasRecentEvents) {
      rateLimitStore.delete(clientId);
      removedClients++;
    }
  }

  if (DEBUG_MODE && (removedClients > 0 || removedEvents > 0)) {
    console.log(`[RateLimiter] Cleanup: removed ${removedClients} clients, ${removedEvents} old events`);
  }
}

/**
 * Clear rate limit data for a specific client
 * Called when client disconnects
 * 
 * @param {string|number} clientId - Client ID
 */
function clearClientRateLimit(clientId) {
  if (rateLimitStore.has(clientId)) {
    rateLimitStore.delete(clientId);
    if (DEBUG_MODE) {
      console.log(`[RateLimiter] Cleared rate limit data for client ${clientId}`);
    }
  }
}

/**
 * Log rate limit exceeded event
 * 
 * @param {string|number} clientId - Client ID
 * @param {string} messageType - Message type
 * @param {Object} limitInfo - Limit information
 */
function logRateLimitExceeded(clientId, messageType, limitInfo) {
  const timestamp = new Date().toISOString();
  console.warn(`[RateLimiter] ⚠️  RATE LIMIT EXCEEDED`);
  console.warn(`  Timestamp:   ${timestamp}`);
  console.warn(`  Client:      ${clientId}`);
  console.warn(`  MessageType: ${messageType}`);
  console.warn(`  Limit:       ${limitInfo.limit.current}/${limitInfo.limit.maxEvents} in ${limitInfo.limit.windowMs}ms`);
  console.warn(`  RetryAfter:  ${limitInfo.retryAfterMs}ms`);
  
  // TODO: Send to monitoring system
}

/**
 * Get rate limit status for a client (for debugging)
 * 
 * @param {string|number} clientId - Client ID
 * @returns {Object} Rate limit status
 */
function getRateLimitStatus(clientId) {
  const clientData = rateLimitStore.get(clientId);
  if (!clientData) {
    return { client: clientId, status: 'no_data' };
  }

  const status = {};
  for (const [key, events] of Object.entries(clientData)) {
    status[key] = {
      count: events.length,
      oldestEvent: events[0] || null,
      newestEvent: events[events.length - 1] || null
    };
  }

  return { client: clientId, status };
}

/**
 * Shutdown the rate limiter
 */
function shutdown() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  rateLimitStore.clear();
}

module.exports = {
  initRateLimiter,
  checkRateLimit,
  clearClientRateLimit,
  getRateLimitStatus,
  shutdown,
  RATE_LIMITS
};
