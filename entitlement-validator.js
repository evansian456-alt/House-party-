/**
 * Entitlement Validator Module (Server-Side)
 * 
 * Enforces strict backend monetization logic for all tier-gated features.
 * NEVER trust client-side tier information.
 * 
 * Tiers:
 * - FREE: 3 phones, audio sync only, no messaging
 * - PARTY_PASS: 4 phones, 2 hours duration, messaging features (£3.99)
 * - PRO_MONTHLY: 10 phones, unlimited time, all features (£9.99/month)
 * 
 * Security Principles:
 * - All entitlement checks happen server-side
 * - Tier information stored in database and Redis
 * - Cannot create session without active entitlement
 * - Cannot exceed participant limits
 * - Cannot bypass limits via frontend manipulation
 */

const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

// Tier constants (must match store-catalog.js)
const TIER = {
  FREE: 'FREE',
  PARTY_PASS: 'PARTY_PASS',
  PRO_MONTHLY: 'PRO_MONTHLY'
};

// Tier limits (must match store-catalog.js and constants)
const TIER_LIMITS = {
  FREE: {
    maxPhones: 3,
    maxDurationMs: null, // No time limit
    features: {
      audioSync: true,
      messaging: false,
      reactions: false,
      customMessages: false,
      analytics: false
    }
  },
  PARTY_PASS: {
    maxPhones: 4,
    maxDurationMs: 2 * 60 * 60 * 1000, // 2 hours
    features: {
      audioSync: true,
      messaging: true,
      reactions: true,
      customMessages: false, // Limited to quick replies
      analytics: false
    }
  },
  PRO_MONTHLY: {
    maxPhones: 10,
    maxDurationMs: null, // Unlimited
    features: {
      audioSync: true,
      messaging: true,
      reactions: true,
      customMessages: true,
      analytics: true
    }
  }
};

/**
 * Validate entitlement for session creation
 * 
 * @param {Object} userEntitlement - User entitlement data from database
 * @param {string} requestedTier - Tier requested for the session
 * @returns {Object} { valid: boolean, tier: string, error?: string }
 */
function validateSessionCreation(userEntitlement, requestedTier) {
  // 1. Determine user's actual tier based on database entitlement
  const actualTier = determineUserTier(userEntitlement);
  
  // 2. Check if user can create a session with requested tier
  if (requestedTier && requestedTier !== TIER.FREE) {
    // User is requesting a paid tier
    if (!canUseTier(actualTier, requestedTier)) {
      return {
        valid: false,
        tier: actualTier,
        error: `Cannot create ${requestedTier} session. Your tier is ${actualTier}. Upgrade required.`
      };
    }
  }
  
  // 3. Use actual tier (prefer user's tier over requested)
  const sessionTier = actualTier !== TIER.FREE ? actualTier : (requestedTier || TIER.FREE);
  
  if (DEBUG_MODE) {
    console.log('[EntitlementValidator] Session creation validated:', {
      actualTier,
      requestedTier,
      sessionTier
    });
  }
  
  return {
    valid: true,
    tier: sessionTier
  };
}

/**
 * Validate session join based on capacity limits
 * 
 * @param {Object} sessionData - Session data with tier and current participant count
 * @param {number} currentParticipants - Current number of participants
 * @returns {Object} { valid: boolean, error?: string, maxPhones?: number }
 */
function validateSessionJoin(sessionData, currentParticipants) {
  const tier = sessionData.tier || TIER.FREE;
  const limits = TIER_LIMITS[tier];
  
  if (!limits) {
    return {
      valid: false,
      error: 'Invalid session tier'
    };
  }
  
  // Check participant limit
  if (currentParticipants >= limits.maxPhones) {
    return {
      valid: false,
      error: `Party is full (${limits.maxPhones} phones max for ${tier} tier)`,
      maxPhones: limits.maxPhones
    };
  }
  
  // Check session duration (for PARTY_PASS)
  if (tier === TIER.PARTY_PASS && limits.maxDurationMs) {
    const sessionAge = Date.now() - (sessionData.createdAt || 0);
    if (sessionAge > limits.maxDurationMs) {
      return {
        valid: false,
        error: 'Party Pass session has expired (2 hour limit)'
      };
    }
  }
  
  return {
    valid: true,
    maxPhones: limits.maxPhones
  };
}

/**
 * Validate feature access based on tier
 * 
 * @param {string} sessionTier - Session tier
 * @param {string} feature - Feature to check (e.g., 'messaging', 'reactions')
 * @returns {Object} { allowed: boolean, error?: string }
 */
function validateFeatureAccess(sessionTier, feature) {
  const limits = TIER_LIMITS[sessionTier];
  
  if (!limits) {
    return {
      allowed: false,
      error: 'Invalid session tier'
    };
  }
  
  const allowed = limits.features[feature] === true;
  
  if (!allowed) {
    return {
      allowed: false,
      error: `Feature '${feature}' not available for ${sessionTier} tier`
    };
  }
  
  return { allowed: true };
}

/**
 * Determine user's current tier based on entitlement data
 * 
 * @param {Object} userEntitlement - User entitlement from database
 * @returns {string} User tier (FREE, PARTY_PASS, or PRO_MONTHLY)
 */
function determineUserTier(userEntitlement) {
  if (!userEntitlement) {
    return TIER.FREE;
  }
  
  // Check Pro Monthly subscription
  if (userEntitlement.proMonthlyActive) {
    // Verify not expired
    if (userEntitlement.proMonthlyExpiresAt) {
      const expiresAt = new Date(userEntitlement.proMonthlyExpiresAt).getTime();
      if (Date.now() < expiresAt) {
        return TIER.PRO_MONTHLY;
      }
    } else {
      // Active with no expiration (lifetime or not set)
      return TIER.PRO_MONTHLY;
    }
  }
  
  // Check Party Pass (per-session, not per-user, but can be stored)
  if (userEntitlement.partyPassActive) {
    if (userEntitlement.partyPassExpiresAt) {
      const expiresAt = new Date(userEntitlement.partyPassExpiresAt).getTime();
      if (Date.now() < expiresAt) {
        return TIER.PARTY_PASS;
      }
    }
  }
  
  // Default to FREE
  return TIER.FREE;
}

/**
 * Check if a user tier can use a requested tier
 * 
 * @param {string} userTier - User's actual tier
 * @param {string} requestedTier - Requested tier for session
 * @returns {boolean} Whether user can use requested tier
 */
function canUseTier(userTier, requestedTier) {
  // Free tier can only use free
  if (userTier === TIER.FREE && requestedTier !== TIER.FREE) {
    return false;
  }
  
  // Party Pass can use Party Pass or Free
  if (userTier === TIER.PARTY_PASS && requestedTier === TIER.PRO_MONTHLY) {
    return false;
  }
  
  // Pro can use everything
  if (userTier === TIER.PRO_MONTHLY) {
    return true;
  }
  
  // Same tier or downgrade is always allowed
  return true;
}

/**
 * Get tier limits for a specific tier
 * 
 * @param {string} tier - Tier to get limits for
 * @returns {Object} Tier limits
 */
function getTierLimits(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
}

/**
 * Check if Party Pass is active for a session
 * 
 * @param {Object} sessionData - Session data with tier and expiration
 * @returns {boolean} Whether Party Pass is active
 */
function isPartyPassActive(sessionData) {
  // PRO_MONTHLY implicitly includes Party Pass features
  if (sessionData.tier === TIER.PRO_MONTHLY) {
    return true;
  }
  
  // PARTY_PASS tier: check expiration
  if (sessionData.tier === TIER.PARTY_PASS) {
    if (!sessionData.partyPassExpiresAt) {
      return false; // No expiration set = not active
    }
    
    const expiresAt = new Date(sessionData.partyPassExpiresAt).getTime();
    return Date.now() < expiresAt;
  }
  
  return false;
}

/**
 * Calculate remaining time for Party Pass session
 * 
 * @param {Object} sessionData - Session data with createdAt timestamp
 * @returns {number} Remaining time in milliseconds (0 if expired or not Party Pass)
 */
function getRemainingTime(sessionData) {
  if (sessionData.tier === TIER.PRO_MONTHLY) {
    return Infinity; // Unlimited
  }
  
  if (sessionData.tier === TIER.PARTY_PASS && sessionData.partyPassExpiresAt) {
    const expiresAt = new Date(sessionData.partyPassExpiresAt).getTime();
    const remaining = expiresAt - Date.now();
    return Math.max(0, remaining);
  }
  
  return Infinity; // Free tier has no time limit
}

/**
 * Log entitlement validation failure for monitoring
 * 
 * @param {string} userId - User ID
 * @param {string} operation - Operation attempted
 * @param {string} reason - Reason for failure
 */
function logValidationFailure(userId, operation, reason) {
  const timestamp = new Date().toISOString();
  console.warn('[EntitlementValidator] ⚠️  VALIDATION FAILURE');
  console.warn(`  Timestamp:  ${timestamp}`);
  console.warn(`  User:       ${userId || 'unknown'}`);
  console.warn(`  Operation:  ${operation}`);
  console.warn(`  Reason:     ${reason}`);
  
  // TODO: Send to monitoring system (Sentry, CloudWatch, etc.)
}

module.exports = {
  TIER,
  TIER_LIMITS,
  validateSessionCreation,
  validateSessionJoin,
  validateFeatureAccess,
  determineUserTier,
  canUseTier,
  getTierLimits,
  isPartyPassActive,
  getRemainingTime,
  logValidationFailure
};
