/**
 * TierPolicy - Single source of truth for tier limits.
 *
 * FREE:        maxDevices=2, maxSessionMinutes=30, no uploads, no Official App Sync
 * PARTY_PASS:  maxDevices=6, maxSessionMinutes=60, 10 uploads/session, Official App Sync
 * PRO /
 * PRO_MONTHLY: maxDevices=6, unlimited time, 100 uploads/month, Official App Sync
 */

const TIER_POLICY = {
  FREE: {
    maxDevices: 2,
    maxSessionMinutes: 30,
    uploadsAllowed: false,
    officialAppSync: false
  },
  PARTY_PASS: {
    maxDevices: 6,
    maxSessionMinutes: 60,
    uploadsAllowed: true,
    maxUploadsPerSession: 10,
    maxUploadMB: 15,
    officialAppSync: true
  },
  // PRO_MONTHLY is the legacy alias used throughout the codebase
  PRO_MONTHLY: {
    maxDevices: 6,
    maxSessionMinutes: null, // unlimited
    uploadsAllowed: true,
    maxUploadsPerMonth: 100,
    maxUploadMB: 15,
    maxUploadsPerSession: 50, // safety cap per session
    officialAppSync: true
  },
  // PRO is a shorthand alias
  PRO: {
    maxDevices: 6,
    maxSessionMinutes: null, // unlimited
    uploadsAllowed: true,
    maxUploadsPerMonth: 100,
    maxUploadMB: 15,
    maxUploadsPerSession: 50,
    officialAppSync: true
  }
};

/**
 * Get policy for a tier. Falls back to FREE for unknown tiers.
 * @param {string} tier
 * @returns {Object} tier policy
 */
function getPolicyForTier(tier) {
  return TIER_POLICY[tier] || TIER_POLICY.FREE;
}

/**
 * Whether the given tier grants access to Official App Sync mode.
 * @param {string} tier - 'FREE' | 'PARTY_PASS' | 'PRO_MONTHLY' | 'PRO'
 * @returns {boolean}
 */
function isPaidForOfficialAppSync(tier) {
  return getPolicyForTier(tier).officialAppSync === true;
}

module.exports = { TIER_POLICY, getPolicyForTier, isPaidForOfficialAppSync };
