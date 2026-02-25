/**
 * Payload Validator
 * 
 * Validates WebSocket message payloads to prevent malicious or malformed data.
 * All incoming messages must pass through validatePayload() before processing.
 * 
 * Security principles:
 * - Define strict schemas for each message type
 * - Reject messages with missing required fields
 * - Validate data types and ranges
 * - Sanitize string inputs
 * - Log validation failures
 */

const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Maximum lengths for string fields (prevent DoS attacks)
const MAX_STRING_LENGTHS = {
  name: 50,
  djName: 50,
  message: 500,
  shortMessage: 100,
  emoji: 10,
  trackId: 100,
  trackUrl: 2000,
  filename: 255,
  title: 255,
  partyCode: 20,
  chatMode: 20,
  source: 50
};

// Payload schemas for each message type
const PAYLOAD_SCHEMAS = {
  HOST_PLAY: {
    required: [],
    optional: ['trackId', 'trackUrl', 'filename', 'title', 'durationMs', 'positionSec'],
    types: {
      trackId: 'string',
      trackUrl: 'string',
      filename: 'string',
      title: 'string',
      durationMs: 'number',
      positionSec: 'number'
    }
  },
  
  HOST_PAUSE: {
    required: [],
    optional: ['positionSec'],
    types: {
      positionSec: 'number'
    }
  },
  
  HOST_STOP: {
    required: [],
    optional: [],
    types: {}
  },
  
  HOST_TRACK_SELECTED: {
    required: ['filename'],
    optional: ['trackId', 'trackUrl', 'title', 'durationMs'],
    types: {
      filename: 'string',
      trackId: 'string',
      trackUrl: 'string',
      title: 'string',
      durationMs: 'number'
    }
  },
  
  HOST_NEXT_TRACK_QUEUED: {
    required: ['filename'],
    optional: ['trackId', 'trackUrl', 'title', 'durationMs'],
    types: {
      filename: 'string',
      trackId: 'string',
      trackUrl: 'string',
      title: 'string',
      durationMs: 'number'
    }
  },
  
  HOST_TRACK_CHANGED: {
    required: ['filename'],
    optional: ['trackId', 'trackUrl', 'title', 'durationMs'],
    types: {
      filename: 'string',
      trackId: 'string',
      trackUrl: 'string',
      title: 'string',
      durationMs: 'number'
    }
  },
  
  CREATE: {
    required: ['djName', 'source'],
    optional: ['isPro', 'tier', 'prototypeMode'],
    types: {
      djName: 'string',
      source: 'string',
      isPro: 'boolean',
      tier: 'string',
      prototypeMode: 'boolean'
    }
  },
  
  JOIN: {
    required: ['code', 'name'],
    optional: ['isPro'],
    types: {
      code: 'string',
      name: 'string',
      isPro: 'boolean'
    }
  },
  
  GUEST_MESSAGE: {
    required: ['message'],
    optional: [],
    types: {
      message: 'string'
    }
  },
  
  GUEST_QUICK_REPLY: {
    required: ['emoji'],
    optional: [],
    types: {
      emoji: 'string'
    }
  },
  
  DJ_QUICK_BUTTON: {
    required: ['buttonId'],
    optional: [],
    types: {
      buttonId: 'string'
    }
  },
  
  DJ_EMOJI: {
    required: ['emoji'],
    optional: [],
    types: {
      emoji: 'string'
    }
  },
  
  DJ_SHORT_MESSAGE: {
    required: ['message'],
    optional: [],
    types: {
      message: 'string'
    }
  },
  
  CHAT_MODE_SET: {
    required: ['chatMode'],
    optional: [],
    types: {
      chatMode: 'string'
    }
  },
  
  HOST_BROADCAST_MESSAGE: {
    required: ['message'],
    optional: [],
    types: {
      message: 'string'
    }
  },
  
  PLAYBACK_FEEDBACK: {
    required: ['trackId', 'currentTimeSec'],
    optional: ['isPlaying', 'driftMs', 'correctionApplied'],
    types: {
      trackId: 'string',
      currentTimeSec: 'number',
      isPlaying: 'boolean',
      driftMs: 'number',
      correctionApplied: 'boolean'
    }
  },
  
  CLOCK_PING: {
    required: ['t1'],
    optional: ['pingId'],
    types: {
      t1: 'number',
      pingId: 'number'
    }
  },
  
  TIME_PING: {
    required: ['clientNowMs'],
    optional: ['pingId'],
    types: {
      clientNowMs: 'number',
      pingId: 'number'
    }
  },
  
  SYNC_ISSUE: {
    required: [],
    optional: ['drift', 'trackId', 'details'],
    types: {
      drift: 'string',
      trackId: 'string',
      details: 'string'
    }
  }
};

/**
 * Validate a WebSocket message payload against its schema
 * 
 * @param {Object} msg - Message object with at least { t: 'TYPE', ...fields }
 * @returns {Object} { valid: boolean, error?: string, sanitized?: Object }
 */
function validatePayload(msg) {
  // 1. Check message has type field
  if (!msg || !msg.t || typeof msg.t !== 'string') {
    return { 
      valid: false, 
      error: 'Message must have a type field (t)' 
    };
  }

  const messageType = msg.t;
  const schema = PAYLOAD_SCHEMAS[messageType];

  // 2. If no schema defined, allow (for backwards compatibility)
  // In strict mode, we could reject unknown message types
  if (!schema) {
    if (DEBUG_MODE) {
      console.log(`[PayloadValidator] No schema for message type: ${messageType}`);
    }
    return { valid: true, sanitized: msg };
  }

  // 3. Check required fields
  for (const field of schema.required) {
    // Use loose equality intentionally: catches both null and undefined
    if (!(field in msg) || msg[field] == null) {
      return {
        valid: false,
        error: `Missing required field: ${field} for message type ${messageType}`
      };
    }
  }

  // 4. Validate types and sanitize
  const sanitized = { t: messageType };
  const allFields = [...schema.required, ...schema.optional];

  for (const field of allFields) {
    if (!(field in msg)) continue; // Optional field not provided

    const value = msg[field];
    const expectedType = schema.types[field];

    // Type validation
    if (expectedType && value !== null && typeof value !== expectedType) {
      return {
        valid: false,
        error: `Invalid type for field ${field}: expected ${expectedType}, got ${typeof value}`
      };
    }

    // String length validation
    if (typeof value === 'string') {
      const maxLength = MAX_STRING_LENGTHS[field] || 1000;
      if (value.length > maxLength) {
        return {
          valid: false,
          error: `Field ${field} exceeds maximum length of ${maxLength}`
        };
      }

      // Reject string literals "null" or "undefined" for URL fields — these are
      // serialization artifacts (e.g. String(null)) and must never reach playback.
      // Compare after trim+lowercase to catch " null", "NULL", "Undefined", etc.
      if (field === 'trackUrl') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'null' || normalized === 'undefined') {
          return {
            valid: false,
            error: `Field trackUrl must not be the string literal "${value.trim()}"`
          };
        }
      }
      
      // Sanitize string (basic XSS prevention)
      sanitized[field] = sanitizeString(value);
    } else {
      sanitized[field] = value;
    }

    // Number range validation
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return {
          valid: false,
          error: `Field ${field} must be a finite number`
        };
      }

      // Specific range checks
      if (field === 'positionSec' && value < 0) {
        return {
          valid: false,
          error: `Field ${field} must be non-negative`
        };
      }
      if (field === 'durationMs' && value < 0) {
        return {
          valid: false,
          error: `Field ${field} must be non-negative`
        };
      }
    }
  }

  // 5. Copy any additional fields not in schema (for extensibility)
  // But log them in debug mode
  for (const field of Object.keys(msg)) {
    if (field !== 't' && !allFields.includes(field)) {
      if (DEBUG_MODE) {
        console.log(`[PayloadValidator] Unexpected field ${field} in ${messageType}`);
      }
      sanitized[field] = msg[field];
    }
  }

  return { valid: true, sanitized };
}

/**
 * Basic string sanitization to prevent XSS and injection attacks
 * 
 * @param {string} str - Input string
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  
  // Remove null bytes
  let sanitized = str.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove control characters except newline and tab
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

/**
 * Log validation failure for security monitoring
 * 
 * @param {Object} msg - Original message
 * @param {string} error - Validation error
 * @param {string|number} clientId - Client ID (if available)
 */
function logValidationFailure(msg, error, clientId) {
  const timestamp = new Date().toISOString();
  console.warn(`[PayloadValidator] ⚠️  VALIDATION FAILURE`);
  console.warn(`  Timestamp:  ${timestamp}`);
  console.warn(`  Client:     ${clientId || 'unknown'}`);
  console.warn(`  MessageType: ${msg?.t || 'unknown'}`);
  console.warn(`  Error:      ${error}`);
  
  if (DEBUG_MODE) {
    console.warn(`  Payload:    ${JSON.stringify(msg)}`);
  }
  
  // TODO: Send to security monitoring system
}

module.exports = {
  validatePayload,
  sanitizeString,
  logValidationFailure,
  PAYLOAD_SCHEMAS
};
