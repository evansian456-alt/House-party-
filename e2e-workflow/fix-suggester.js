/**
 * Fix Suggester Module
 * 
 * Analyzes failures and suggests safe fixes for common issues.
 * Categorizes fixes as safe (auto-apply) or complex (manual review needed).
 */

const { FAILURE_TYPES } = require('./failure-analyzer');

/**
 * Fix safety levels
 */
const FIX_SAFETY = {
  SAFE: 'safe',           // Can be auto-applied
  MODERATE: 'moderate',   // Requires review
  COMPLEX: 'complex'      // Requires manual intervention
};

/**
 * Generate fix suggestion for a failure
 * @param {Object} analyzedFailure - Analyzed failure object
 * @returns {Object} Fix suggestion
 */
function suggestFix(analyzedFailure) {
  const { failureType, error, affectedComponent, context } = analyzedFailure;
  
  let suggestion = null;
  
  switch (failureType) {
    case FAILURE_TYPES.FRONTEND_UI:
      suggestion = suggestFrontendFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.BACKEND_API:
      suggestion = suggestBackendFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.NETWORK:
      suggestion = suggestNetworkFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.ROLE_BASED:
      suggestion = suggestRoleBasedFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.MUSIC_SYNC:
      suggestion = suggestMusicSyncFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.REACTIONS:
      suggestion = suggestReactionsFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.MESSAGING:
      suggestion = suggestMessagingFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.ANIMATIONS:
      suggestion = suggestAnimationsFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.AUTHENTICATION:
      suggestion = suggestAuthenticationFix(error, affectedComponent, context);
      break;
    case FAILURE_TYPES.NAVIGATION:
      suggestion = suggestNavigationFix(error, affectedComponent, context);
      break;
    default:
      suggestion = suggestGenericFix(error, affectedComponent, context);
  }
  
  return suggestion;
}

/**
 * Suggest fix for frontend UI issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestFrontendFix(error, component, context) {
  const errorMsg = error.message.toLowerCase();
  
  // Selector not found
  if (errorMsg.includes('locator') || errorMsg.includes('selector') || errorMsg.includes('element not found')) {
    return {
      type: 'missing_element',
      safety: FIX_SAFETY.MODERATE,
      description: 'Element selector not found - may indicate missing UI element or incorrect selector',
      suggestedChanges: [
        {
          file: 'index.html',
          action: 'Check if element with the required selector exists',
          code: `<!-- Ensure element exists with correct ID/class/selector -->
<!-- Example: <button id="btn-target" class="btn">Click Me</button> -->`
        },
        {
          file: 'Test file',
          action: 'Update selector to match actual DOM structure',
          code: `// Update selector to be more flexible
// Instead of: page.locator('#specific-id')
// Try: page.locator('button:has-text("Button Text")')`
        }
      ],
      explanation: 'This error typically occurs when the UI element is missing, has a different selector, or is not rendered when expected. Verify the element exists in the HTML and update the test selector if needed.'
    };
  }
  
  // Element not visible
  if (errorMsg.includes('not visible') || errorMsg.includes('not attached')) {
    return {
      type: 'element_not_visible',
      safety: FIX_SAFETY.SAFE,
      description: 'Element exists but is not visible - check CSS display/visibility',
      suggestedChanges: [
        {
          file: 'styles.css',
          action: 'Ensure element is visible by default or when needed',
          code: `/* Check if element has display: none or visibility: hidden */
/* Ensure proper visibility classes are applied */
.element-class {
  display: block; /* or flex, inline-block, etc. */
  visibility: visible;
}`
        }
      ],
      explanation: 'The element exists in the DOM but is not visible. This could be due to CSS display:none, visibility:hidden, or conditional rendering. Ensure the element is visible when the test expects it.'
    };
  }
  
  // Timeout waiting for element
  if (errorMsg.includes('timeout')) {
    return {
      type: 'timeout',
      safety: FIX_SAFETY.MODERATE,
      description: 'Timeout waiting for element - may need to increase wait time or check async operations',
      suggestedChanges: [
        {
          file: 'Test file',
          action: 'Increase timeout or wait for proper condition',
          code: `// Increase timeout for slow operations
await page.locator('selector', { timeout: 10000 });

// Or wait for specific state
await page.waitForLoadState('networkidle');`
        }
      ],
      explanation: 'The test timed out waiting for an element. This could indicate slow loading, async operations not completing, or the element never appearing. Consider increasing timeout or ensuring proper wait conditions.'
    };
  }
  
  return {
    type: 'generic_ui',
    safety: FIX_SAFETY.MODERATE,
    description: 'Generic UI issue detected',
    suggestedChanges: [],
    explanation: 'A UI-related error occurred. Review the error message and DOM structure to identify the specific issue.'
  };
}

/**
 * Suggest fix for backend/API issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestBackendFix(error, component, context) {
  const errorMsg = error.message.toLowerCase();
  const failedRequests = context.failedRequests || [];
  
  // API endpoint error
  if (failedRequests.length > 0) {
    const req = failedRequests[0];
    
    return {
      type: 'api_error',
      safety: FIX_SAFETY.COMPLEX,
      description: `API request failed: ${req.method} ${req.url} - Status ${req.status}`,
      suggestedChanges: [
        {
          file: 'server.js',
          action: 'Check endpoint handler and error handling',
          code: `// Verify endpoint exists and handles request properly
app.${req.method.toLowerCase()}('${req.url}', async (req, res) => {
  try {
    // Handle request
    res.json({ success: true });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});`
        }
      ],
      explanation: `The API endpoint ${req.url} returned status ${req.status}. Check server logs, verify the endpoint exists, and ensure proper error handling.`
    };
  }
  
  return {
    type: 'generic_backend',
    safety: FIX_SAFETY.COMPLEX,
    description: 'Backend/API issue detected',
    suggestedChanges: [],
    explanation: 'A backend or API error occurred. Check server logs and network requests for more details.'
  };
}

/**
 * Suggest fix for network/connection issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestNetworkFix(error, component, context) {
  return {
    type: 'network_issue',
    safety: FIX_SAFETY.COMPLEX,
    description: 'Network or WebSocket connection issue',
    suggestedChanges: [
      {
        file: 'app.js',
        action: 'Add reconnection logic for WebSocket',
        code: `// Add WebSocket reconnection logic
function reconnectWebSocket() {
  if (ws && ws.readyState !== WebSocket.OPEN) {
    console.log('Attempting to reconnect WebSocket...');
    initializeWebSocket();
  }
}

// Call reconnection on disconnect
ws.onclose = () => {
  console.log('WebSocket closed, reconnecting...');
  setTimeout(reconnectWebSocket, 1000);
};`
      }
    ],
    explanation: 'A network or WebSocket connection issue occurred. Implement reconnection logic and handle disconnections gracefully.'
  };
}

/**
 * Suggest fix for role-based access issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestRoleBasedFix(error, component, context) {
  return {
    type: 'role_based_access',
    safety: FIX_SAFETY.MODERATE,
    description: 'Role-based access or permission issue',
    suggestedChanges: [
      {
        file: 'app.js / index.html',
        action: 'Verify role-based UI visibility',
        code: `// Ensure host-only elements are properly hidden for guests
if (state.isHost) {
  document.getElementById('host-only-element').style.display = 'block';
} else {
  document.getElementById('host-only-element').style.display = 'none';
}`
      }
    ],
    explanation: 'A role-based access issue occurred. Ensure host-only and guest-only elements are properly shown/hidden based on user role.'
  };
}

/**
 * Suggest fix for music sync issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestMusicSyncFix(error, component, context) {
  return {
    type: 'music_sync',
    safety: FIX_SAFETY.COMPLEX,
    description: 'Music synchronization or playback issue',
    suggestedChanges: [
      {
        file: 'sync-engine.js / app.js',
        action: 'Check sync engine and playback state',
        code: `// Verify sync engine is properly initialized
// Check playback timestamp sync
// Ensure queue updates are broadcast to all clients`
      }
    ],
    explanation: 'A music synchronization issue occurred. This requires checking the sync engine, playback state management, and WebSocket message handling.'
  };
}

/**
 * Suggest fix for reactions issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestReactionsFix(error, component, context) {
  return {
    type: 'reactions',
    safety: FIX_SAFETY.MODERATE,
    description: 'Reaction or crowd energy system issue',
    suggestedChanges: [
      {
        file: 'app.js',
        action: 'Check reaction handlers and crowd energy updates',
        code: `// Verify reaction buttons send proper messages
// Check crowd energy calculation
// Ensure leaderboard updates correctly`
      }
    ],
    explanation: 'A reaction system issue occurred. Verify reaction event handlers, crowd energy calculations, and leaderboard updates.'
  };
}

/**
 * Suggest fix for messaging issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestMessagingFix(error, component, context) {
  return {
    type: 'messaging',
    safety: FIX_SAFETY.MODERATE,
    description: 'Messaging or chat system issue',
    suggestedChanges: [
      {
        file: 'app.js / server.js',
        action: 'Check message sending and broadcasting',
        code: `// Verify message WebSocket handlers
// Check message delivery to all clients
// Ensure chat mode permissions are enforced`
      }
    ],
    explanation: 'A messaging issue occurred. Verify WebSocket message handlers, message broadcasting, and chat permissions.'
  };
}

/**
 * Suggest fix for animation issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestAnimationsFix(error, component, context) {
  return {
    type: 'animations',
    safety: FIX_SAFETY.SAFE,
    description: 'Animation or visual effect issue',
    suggestedChanges: [
      {
        file: 'styles.css',
        action: 'Ensure animation CSS is defined',
        code: `/* Define animation keyframes */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animated-element {
  animation: fadeIn 0.3s ease-in;
}`
      }
    ],
    explanation: 'An animation issue occurred. Ensure CSS animations are properly defined and applied to the correct elements.'
  };
}

/**
 * Suggest fix for authentication issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestAuthenticationFix(error, component, context) {
  return {
    type: 'authentication',
    safety: FIX_SAFETY.COMPLEX,
    description: 'Authentication or session issue',
    suggestedChanges: [
      {
        file: 'auth.js / app.js',
        action: 'Check token storage and validation',
        code: `// Verify token is stored in localStorage
// Check token expiration
// Ensure authentication middleware is working`
      }
    ],
    explanation: 'An authentication issue occurred. Verify token storage, validation, and authentication middleware.'
  };
}

/**
 * Suggest fix for navigation issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestNavigationFix(error, component, context) {
  return {
    type: 'navigation',
    safety: FIX_SAFETY.SAFE,
    description: 'Navigation or routing issue',
    suggestedChanges: [
      {
        file: 'app.js',
        action: 'Check navigation handlers',
        code: `// Verify navigation functions work correctly
// Check view transitions
// Ensure proper state management during navigation`
      }
    ],
    explanation: 'A navigation issue occurred. Verify navigation handlers and view transitions work correctly.'
  };
}

/**
 * Suggest generic fix for unknown issues
 * @param {Object} error - Error details
 * @param {string} component - Affected component
 * @param {Object} context - Failure context
 * @returns {Object} Fix suggestion
 */
function suggestGenericFix(error, component, context) {
  return {
    type: 'generic',
    safety: FIX_SAFETY.COMPLEX,
    description: 'Unknown issue type',
    suggestedChanges: [],
    explanation: `An error occurred: ${error.message}. Review the error details, logs, and test context to identify the root cause.`
  };
}

module.exports = {
  suggestFix,
  FIX_SAFETY
};
