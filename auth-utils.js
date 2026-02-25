/**
 * Shared authentication validation utilities
 * Compatible with both Node.js and browser environments
 */

/**
 * Validate email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function isValidPassword(password) {
  if (!password || typeof password !== 'string') {
    return false;
  }
  return password.length >= 6;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { isValidEmail, isValidPassword };
}
