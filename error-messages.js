/**
 * Error Messages & User-Friendly Feedback
 * 
 * This module provides context-aware, actionable error messages for better UX.
 * Reference: MISSING_FEATURES.md Section 5.2 - Poor Error Messages
 */

/**
 * Party-related error messages
 */
const PARTY_ERRORS = {
  NOT_FOUND: {
    title: 'Party Not Found',
    message: 'We couldn\'t find a party with that code. Please check for typos and try again.',
    actions: ['Double-check the party code', 'Ask the host for the correct code', 'Try creating a new party']
  },
  EXPIRED: {
    title: 'Party Expired',
    message: 'This party has ended. Parties last for 2 hours (Free/Party Pass) or 8 hours (Pro Monthly).',
    actions: ['Join a different party', 'Create a new party']
  },
  ENDED: {
    title: 'Party Ended',
    message: 'The host ended this party.',
    actions: ['Join a different party', 'Create your own party']
  },
  FULL: {
    title: 'Party Full',
    message: 'This party has reached its maximum capacity.',
    details: 'Free parties allow 2 phones, Party Pass allows 10 phones, Pro Monthly allows 10 phones.',
    actions: ['Wait for someone to leave', 'Ask the host to upgrade to Party Pass or Pro Monthly']
  },
  ALREADY_IN_PARTY: {
    title: 'Already in Party',
    message: 'You\'re already in a party. Leave your current party before joining another.',
    actions: ['End your current party if you\'re the host', 'Leave your current party if you\'re a guest']
  }
};

/**
 * Connection-related error messages
 */
const CONNECTION_ERRORS = {
  NETWORK_FAILED: {
    title: 'Network Error',
    message: 'Could not connect to the server. Please check your internet connection.',
    actions: ['Check your WiFi or mobile data', 'Try refreshing the page', 'Check if the server is online']
  },
  WEBSOCKET_FAILED: {
    title: 'Real-Time Connection Failed',
    message: 'Lost connection to the party. Trying to reconnect...',
    actions: ['Keep this page open', 'Check your internet connection', 'Refresh if connection doesn\'t restore']
  },
  SERVER_DOWN: {
    title: 'Server Unavailable',
    message: 'The Phone Party server is temporarily unavailable. Please try again in a few minutes.',
    actions: ['Wait a few minutes and try again', 'Check server status page (if available)']
  },
  RATE_LIMITED: {
    title: 'Too Many Requests',
    message: 'You\'re doing that too quickly. Please wait a moment and try again.',
    details: 'Rate limiting helps keep Phone Party fast and reliable for everyone.',
    actions: ['Wait 15-60 seconds', 'Try your action again']
  },
  TIMEOUT: {
    title: 'Request Timeout',
    message: 'The request took too long. This might be due to a slow connection.',
    actions: ['Check your internet connection', 'Try again', 'Switch to a faster network if available']
  }
};

/**
 * Sync-related error messages
 */
const SYNC_ERRORS = {
  DRIFT_DETECTED: {
    title: 'Sync Drift Detected',
    message: 'Your device is slightly out of sync. We\'re automatically correcting this.',
    details: 'Drift happens due to network delays or device performance. Normal drift is <200ms.',
    actions: ['Wait for auto-correction', 'Use the manual sync button if needed', 'Check your network connection']
  },
  MANUAL_SYNC_NEEDED: {
    title: 'Manual Sync Required',
    message: 'Automatic sync correction failed. Please tap the sync button to resync manually.',
    actions: ['Tap the sync button', 'Check your network connection', 'Move closer to your WiFi router']
  },
  CLOCK_SYNC_FAILED: {
    title: 'Clock Sync Failed',
    message: 'Could not synchronize your device clock with the party host.',
    actions: ['Refresh the page', 'Check your internet connection', 'Try rejoining the party']
  }
};

/**
 * Authentication error messages
 */
const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    title: 'Login Failed',
    message: 'Invalid email or password. Please try again.',
    actions: ['Check your email for typos', 'Make sure your password is correct', 'Reset your password if forgotten']
  },
  EMAIL_IN_USE: {
    title: 'Email Already Registered',
    message: 'An account with this email already exists.',
    actions: ['Log in with this email', 'Use a different email address', 'Reset your password if you forgot it']
  },
  WEAK_PASSWORD: {
    title: 'Password Too Weak',
    message: 'Password must be at least 8 characters long.',
    actions: ['Use at least 8 characters', 'Include letters, numbers, and symbols for extra security']
  },
  INVALID_EMAIL: {
    title: 'Invalid Email',
    message: 'Please enter a valid email address.',
    actions: ['Check for typos', 'Make sure it includes @ and a domain (e.g., example.com)']
  },
  SESSION_EXPIRED: {
    title: 'Session Expired',
    message: 'Your session has expired. Please log in again.',
    actions: ['Log in again', 'Your data is safe and will be restored after login']
  }
};

/**
 * Payment error messages
 */
const PAYMENT_ERRORS = {
  PAYMENT_FAILED: {
    title: 'Payment Failed',
    message: 'We couldn\'t process your payment. Please check your payment method and try again.',
    actions: ['Check your card details', 'Ensure sufficient funds', 'Try a different payment method', 'Contact your bank if issue persists']
  },
  INVALID_CARD: {
    title: 'Invalid Card',
    message: 'The card information provided is invalid.',
    actions: ['Check card number', 'Check expiry date', 'Check CVV code', 'Try a different card']
  },
  INSUFFICIENT_FUNDS: {
    title: 'Insufficient Funds',
    message: 'Your payment method has insufficient funds.',
    actions: ['Add funds to your account', 'Try a different payment method']
  },
  ALREADY_SUBSCRIBED: {
    title: 'Already Subscribed',
    message: 'You already have an active Pro Monthly subscription.',
    actions: ['Manage your subscription in settings', 'Contact support if you see an error']
  }
};

/**
 * Tier restriction error messages
 */
const TIER_ERRORS = {
  UPGRADE_REQUIRED: {
    title: 'Upgrade Required',
    message: 'This feature requires Party Pass or Pro Monthly.',
    actions: ['Purchase Party Pass (£2.99, 2 hours)', 'Subscribe to Pro Monthly (£9.99/month)', 'Learn more about features']
  },
  GUEST_LIMIT: {
    title: 'Guest Limit Reached',
    message: 'Free parties are limited to 2 phones. Upgrade to Party Pass or Pro Monthly for up to 10 phones.',
    actions: ['Purchase Party Pass (£2.99)', 'Subscribe to Pro Monthly (£9.99/month)', 'End party and create a smaller one']
  },
  MESSAGING_RESTRICTED: {
    title: 'Messaging Not Available',
    message: 'Host messaging requires Party Pass or Pro Monthly.',
    actions: ['Purchase Party Pass for this session', 'Subscribe to Pro Monthly for unlimited messaging']
  }
};

/**
 * Get user-friendly error message based on error type and context
 * @param {string} errorType - Type of error (e.g., 'PARTY_NOT_FOUND')
 * @param {string} category - Category of error (e.g., 'PARTY', 'CONNECTION')
 * @param {object} context - Additional context (e.g., party code, user tier)
 * @returns {object} Error message object with title, message, details, and actions
 */
function getUserFriendlyError(errorType, category = 'PARTY', context = {}) {
  const errorCategories = {
    PARTY: PARTY_ERRORS,
    CONNECTION: CONNECTION_ERRORS,
    SYNC: SYNC_ERRORS,
    AUTH: AUTH_ERRORS,
    PAYMENT: PAYMENT_ERRORS,
    TIER: TIER_ERRORS
  };

  const categoryErrors = errorCategories[category] || PARTY_ERRORS;
  const error = categoryErrors[errorType];

  if (!error) {
    return {
      title: 'An Error Occurred',
      message: 'Something went wrong. Please try again.',
      actions: ['Refresh the page', 'Contact support if the problem persists']
    };
  }

  // Add context-specific details if available
  const enrichedError = { ...error };
  
  if (context.partyCode) {
    enrichedError.message += ` (Party Code: ${context.partyCode})`;
  }
  
  if (context.retryAfter) {
    enrichedError.actions = [`Wait ${context.retryAfter} seconds`, ...enrichedError.actions];
  }

  return enrichedError;
}

/**
 * Display error to user with toast notification or modal
 * @param {object} error - Error object from getUserFriendlyError
 * @param {string} displayType - 'toast' or 'modal'
 */
function displayError(error, displayType = 'toast') {
  if (displayType === 'toast' && typeof toast === 'function') {
    toast(`❌ ${error.title}: ${error.message}`);
  } else if (displayType === 'modal' && typeof showModal === 'function') {
    showModal({
      title: error.title,
      message: error.message,
      details: error.details,
      actions: error.actions
    });
  } else {
    // Fallback to console
    console.error(`[Error] ${error.title}:`, error.message);
    if (error.actions) {
      console.info('[Suggested Actions]:', error.actions);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    PARTY_ERRORS,
    CONNECTION_ERRORS,
    SYNC_ERRORS,
    AUTH_ERRORS,
    PAYMENT_ERRORS,
    TIER_ERRORS,
    getUserFriendlyError,
    displayError
  };
}
