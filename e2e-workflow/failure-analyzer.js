/**
 * Failure Analyzer Module
 * 
 * Analyzes test failures and categorizes them by type.
 * Extracts context, screenshots, and logs for debugging.
 */

const fs = require('fs');
const path = require('path');

/**
 * Failure types
 */
const FAILURE_TYPES = {
  FRONTEND_UI: 'frontend_ui',
  BACKEND_API: 'backend_api',
  NETWORK: 'network',
  ROLE_BASED: 'role_based',
  MUSIC_SYNC: 'music_sync',
  REACTIONS: 'reactions',
  MESSAGING: 'messaging',
  ANIMATIONS: 'animations',
  AUTHENTICATION: 'authentication',
  NAVIGATION: 'navigation',
  UNKNOWN: 'unknown'
};

/**
 * Analyze a test failure and categorize it
 * @param {Object} failure - Test failure object from Playwright/Jest
 * @returns {Object} Analyzed failure with categorization
 */
function analyzeFailure(failure) {
  const {
    testName,
    testFile,
    error,
    screenshot,
    video,
    logs = [],
    networkRequests = []
  } = failure;
  
  // Detect failure type from error message and context
  const failureType = detectFailureType(error, testFile, logs, networkRequests);
  
  // Extract relevant context
  const context = extractContext(error, logs, networkRequests, failureType);
  
  // Determine affected component/feature
  const affectedComponent = determineAffectedComponent(testFile, testName, error);
  
  return {
    testName,
    testFile,
    failureType,
    affectedComponent,
    error: {
      message: error.message || error,
      stack: error.stack || '',
      line: extractLineNumber(error)
    },
    context,
    artifacts: {
      screenshot: screenshot || null,
      video: video || null,
      logs: logs.slice(-50) // Last 50 log entries
    },
    timestamp: new Date().toISOString(),
    suggestedFix: null // Will be populated by fix suggester
  };
}

/**
 * Detect failure type from error and context
 * @param {Error|string} error - Error object or message
 * @param {string} testFile - Test file name
 * @param {Array} logs - Console logs
 * @param {Array} networkRequests - Network request logs
 * @returns {string} Failure type
 */
function detectFailureType(error, testFile, logs, networkRequests) {
  const errorMsg = (error.message || error).toLowerCase();
  const testFileName = testFile.toLowerCase();
  
  // Check for frontend UI issues
  if (
    errorMsg.includes('locator') ||
    errorMsg.includes('selector') ||
    errorMsg.includes('element not found') ||
    errorMsg.includes('not visible') ||
    errorMsg.includes('timeout') && errorMsg.includes('button') ||
    errorMsg.includes('timeout') && errorMsg.includes('element')
  ) {
    return FAILURE_TYPES.FRONTEND_UI;
  }
  
  // Check for backend/API issues
  if (
    errorMsg.includes('api') ||
    errorMsg.includes('endpoint') ||
    errorMsg.includes('status 500') ||
    errorMsg.includes('status 400') ||
    errorMsg.includes('network error') ||
    networkRequests.some(r => r.status >= 400)
  ) {
    return FAILURE_TYPES.BACKEND_API;
  }
  
  // Check for network/connection issues
  if (
    errorMsg.includes('websocket') ||
    errorMsg.includes('connection') ||
    errorMsg.includes('disconnect') ||
    errorMsg.includes('network') ||
    logs.some(log => log.includes('WebSocket') && log.includes('closed'))
  ) {
    return FAILURE_TYPES.NETWORK;
  }
  
  // Check for role-based issues
  if (
    errorMsg.includes('unauthorized') ||
    errorMsg.includes('permission') ||
    errorMsg.includes('access denied') ||
    errorMsg.includes('host only') ||
    errorMsg.includes('guest only') ||
    testFileName.includes('role') ||
    testFileName.includes('host') && errorMsg.includes('guest')
  ) {
    return FAILURE_TYPES.ROLE_BASED;
  }
  
  // Check for music sync issues
  if (
    testFileName.includes('music') ||
    testFileName.includes('sync') ||
    testFileName.includes('queue') ||
    errorMsg.includes('playback') ||
    errorMsg.includes('sync') ||
    errorMsg.includes('drift')
  ) {
    return FAILURE_TYPES.MUSIC_SYNC;
  }
  
  // Check for reaction issues
  if (
    testFileName.includes('reaction') ||
    testFileName.includes('emoji') ||
    testFileName.includes('crowd') ||
    errorMsg.includes('reaction') ||
    errorMsg.includes('crowd energy') ||
    errorMsg.includes('leaderboard')
  ) {
    return FAILURE_TYPES.REACTIONS;
  }
  
  // Check for messaging issues
  if (
    testFileName.includes('messag') ||
    testFileName.includes('chat') ||
    errorMsg.includes('message') ||
    errorMsg.includes('chat')
  ) {
    return FAILURE_TYPES.MESSAGING;
  }
  
  // Check for animation issues
  if (
    testFileName.includes('animation') ||
    testFileName.includes('visual') ||
    errorMsg.includes('animation') ||
    errorMsg.includes('transition')
  ) {
    return FAILURE_TYPES.ANIMATIONS;
  }
  
  // Check for authentication issues
  if (
    testFileName.includes('auth') ||
    testFileName.includes('login') ||
    errorMsg.includes('token') ||
    errorMsg.includes('authentication') ||
    errorMsg.includes('login')
  ) {
    return FAILURE_TYPES.AUTHENTICATION;
  }
  
  // Check for navigation issues
  if (
    testFileName.includes('navigation') ||
    errorMsg.includes('navigation') ||
    errorMsg.includes('route') ||
    errorMsg.includes('redirect')
  ) {
    return FAILURE_TYPES.NAVIGATION;
  }
  
  return FAILURE_TYPES.UNKNOWN;
}

/**
 * Extract relevant context from logs and network requests
 * @param {Error|string} error - Error object
 * @param {Array} logs - Console logs
 * @param {Array} networkRequests - Network requests
 * @param {string} failureType - Type of failure
 * @returns {Object} Context object
 */
function extractContext(error, logs, networkRequests, failureType) {
  const context = {
    errorDetails: error.message || error,
    relevantLogs: [],
    failedRequests: [],
    stateSnapshot: null
  };
  
  // Extract relevant logs based on failure type
  const logFilters = {
    [FAILURE_TYPES.FRONTEND_UI]: ['error', 'warning', 'element', 'selector'],
    [FAILURE_TYPES.BACKEND_API]: ['api', 'request', 'response', 'error'],
    [FAILURE_TYPES.NETWORK]: ['websocket', 'connection', 'network', 'disconnect'],
    [FAILURE_TYPES.MUSIC_SYNC]: ['sync', 'playback', 'drift', 'queue'],
    [FAILURE_TYPES.REACTIONS]: ['reaction', 'emoji', 'crowd', 'leaderboard'],
    [FAILURE_TYPES.MESSAGING]: ['message', 'chat', 'notification']
  };
  
  const filters = logFilters[failureType] || ['error'];
  context.relevantLogs = logs.filter(log => 
    filters.some(filter => log.toLowerCase().includes(filter))
  ).slice(-20);
  
  // Extract failed network requests
  context.failedRequests = networkRequests
    .filter(req => req.status >= 400)
    .map(req => ({
      url: req.url,
      method: req.method,
      status: req.status,
      statusText: req.statusText
    }));
  
  return context;
}

/**
 * Determine affected component from test info
 * @param {string} testFile - Test file name
 * @param {string} testName - Test name
 * @param {Error|string} error - Error object
 * @returns {string} Affected component
 */
function determineAffectedComponent(testFile, testName, error) {
  const errorMsg = (error.message || error).toLowerCase();
  
  // Check for specific selectors in error
  if (errorMsg.includes('btn-')) {
    const match = errorMsg.match(/btn-([a-z-]+)/);
    if (match) return `Button: ${match[1]}`;
  }
  
  if (errorMsg.includes('#')) {
    const match = errorMsg.match(/#([a-z-]+)/);
    if (match) return `Element ID: ${match[1]}`;
  }
  
  if (errorMsg.includes('.')) {
    const match = errorMsg.match(/\.([a-z-]+)/);
    if (match) return `CSS Class: ${match[1]}`;
  }
  
  // Extract from test name
  if (testName) {
    if (testName.includes('party')) return 'Party Management';
    if (testName.includes('music')) return 'Music Player';
    if (testName.includes('queue')) return 'Queue System';
    if (testName.includes('reaction')) return 'Reactions';
    if (testName.includes('message') || testName.includes('chat')) return 'Messaging';
    if (testName.includes('auth') || testName.includes('login')) return 'Authentication';
  }
  
  return 'Unknown Component';
}

/**
 * Extract line number from error
 * @param {Error|string} error - Error object
 * @returns {number|null} Line number
 */
function extractLineNumber(error) {
  if (!error.stack) return null;
  
  const match = error.stack.match(/:(\d+):\d+/);
  return match ? parseInt(match[1]) : null;
}

/**
 * Categorize multiple failures
 * @param {Array} failures - Array of analyzed failures
 * @returns {Object} Categorized failures
 */
function categorizeFailures(failures) {
  const categorized = {};
  
  for (const failure of failures) {
    const type = failure.failureType;
    if (!categorized[type]) {
      categorized[type] = [];
    }
    categorized[type].push(failure);
  }
  
  return categorized;
}

module.exports = {
  analyzeFailure,
  categorizeFailures,
  FAILURE_TYPES
};
