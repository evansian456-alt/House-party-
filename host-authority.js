/**
 * Host Authority Validator
 * 
 * Enforces strict server-side host authority for all privileged operations.
 * NEVER trusts client-side flags like { isHost: true }.
 * 
 * Security principles:
 * - All host operations must pass through validateHostAuthority()
 * - Compare socket.userId (or clientId) === session.hostId
 * - Log all unauthorized attempts
 * - Emit detailed error responses
 */

const DEBUG_MODE = process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development';

/**
 * Validate that the WebSocket client has host authority for the given party
 * 
 * @param {WebSocket} ws - WebSocket connection
 * @param {Map} clients - Map of ws -> client data
 * @param {Map} parties - Map of partyCode -> party data
 * @param {string} partyCode - Party code
 * @param {string} operation - Name of the operation being attempted (for logging)
 * @returns {Object} { valid: boolean, error?: string, client?: Object, party?: Object }
 */
function validateHostAuthority(ws, clients, parties, partyCode, operation) {
  // 1. Validate WebSocket client exists
  const client = clients.get(ws);
  if (!client) {
    const error = 'Client not found - invalid WebSocket connection';
    logUnauthorized(null, null, operation, error);
    return { valid: false, error };
  }

  // 2. Validate party exists
  const party = parties.get(partyCode);
  if (!party) {
    const error = `Party ${partyCode} not found`;
    logUnauthorized(client.id, partyCode, operation, error);
    return { valid: false, error };
  }

  // 3. Critical: Validate client ID matches party hostId
  // This is the core security check - NEVER trust client flags
  if (!party.hostId) {
    const error = 'Party has no hostId - data corruption';
    logUnauthorized(client.id, partyCode, operation, error);
    return { valid: false, error };
  }

  // Compare as strings to handle type coercion
  if (String(client.id) !== String(party.hostId)) {
    const error = `Forbidden: Only the party host can ${operation}`;
    logUnauthorized(client.id, partyCode, operation, 
      `Client ${client.id} is not host (host is ${party.hostId})`);
    return { valid: false, error };
  }

  // 4. Additional check: Verify WebSocket connection is the registered host
  // This provides defense in depth
  if (party.host && party.host !== ws) {
    const error = 'WebSocket mismatch - potential session hijacking';
    logUnauthorized(client.id, partyCode, operation, error);
    return { valid: false, error };
  }

  // All checks passed
  if (DEBUG_MODE) {
    console.log(`[HostAuth] ✓ Client ${client.id} authorized for ${operation} in party ${partyCode}`);
  }

  return { valid: true, client, party };
}

/**
 * Validate host authority for HTTP requests with hostId in body
 * 
 * @param {string} providedHostId - Host ID from request body
 * @param {Object} partyData - Party data from storage (Redis/fallback)
 * @param {string} operation - Name of the operation being attempted
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateHostAuthorityHTTP(providedHostId, partyData, operation) {
  // 1. Validate hostId is provided
  if (!providedHostId) {
    const error = 'hostId is required for this operation';
    logUnauthorized(providedHostId, partyData?.partyCode, operation, error);
    return { valid: false, error };
  }

  // 2. Validate party data exists and has hostId
  if (!partyData || !partyData.hostId) {
    const error = 'Party not found or invalid party data';
    logUnauthorized(providedHostId, partyData?.partyCode, operation, error);
    return { valid: false, error };
  }

  // 3. Critical: Compare providedHostId with stored hostId
  if (String(providedHostId) !== String(partyData.hostId)) {
    const error = `Forbidden: Only the party host can ${operation}`;
    logUnauthorized(providedHostId, partyData.partyCode, operation,
      `Provided hostId ${providedHostId} does not match party hostId ${partyData.hostId}`);
    return { valid: false, error };
  }

  if (DEBUG_MODE) {
    console.log(`[HostAuth] ✓ HTTP request authorized for ${operation} in party ${partyData.partyCode || 'unknown'}`);
  }

  return { valid: true };
}

/**
 * Log unauthorized access attempts
 * Includes detailed information for security auditing
 * 
 * @param {string|number} clientId - Client ID attempting the operation
 * @param {string} partyCode - Party code
 * @param {string} operation - Operation attempted
 * @param {string} reason - Reason for rejection
 */
function logUnauthorized(clientId, partyCode, operation, reason) {
  const timestamp = new Date().toISOString();
  console.warn(`[HostAuth] ⚠️  UNAUTHORIZED ATTEMPT`);
  console.warn(`  Timestamp:  ${timestamp}`);
  console.warn(`  Client:     ${clientId || 'unknown'}`);
  console.warn(`  Party:      ${partyCode || 'unknown'}`);
  console.warn(`  Operation:  ${operation}`);
  console.warn(`  Reason:     ${reason}`);
  
  // TODO: In production, send to security monitoring system (Sentry, CloudWatch, etc.)
}

/**
 * Create a standardized error response for unauthorized attempts
 * 
 * @param {string} operation - Operation that was attempted
 * @param {string} error - Error message
 * @returns {Object} Standardized error response
 */
function createUnauthorizedError(operation, error) {
  return {
    t: 'ERROR',
    errorType: 'UNAUTHORIZED',
    operation,
    message: error || `Forbidden: Only the party host can ${operation}`,
    timestamp: Date.now()
  };
}

module.exports = {
  validateHostAuthority,
  validateHostAuthorityHTTP,
  logUnauthorized,
  createUnauthorizedError
};
