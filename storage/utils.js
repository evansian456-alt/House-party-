/**
 * Storage Provider Utilities
 * 
 * Shared utilities for storage providers to ensure consistency
 */

/**
 * Map content types to file extensions
 */
const CONTENT_TYPE_EXTENSIONS = {
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
  'audio/flac': '.flac',
  'audio/aac': '.aac'
};

/**
 * Get file extension from content type
 * @param {string} contentType - MIME type
 * @returns {string|null} - Extension with dot (e.g., '.mp3') or null
 */
function getExtensionFromContentType(contentType) {
  return CONTENT_TYPE_EXTENSIONS[contentType] || null;
}

/**
 * Get file extension from filename
 * @param {string} filename - Original filename
 * @returns {string|null} - Extension with dot or null
 */
function getExtensionFromFilename(filename) {
  if (!filename) return null;
  const path = require('path');
  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : null;
}

module.exports = {
  CONTENT_TYPE_EXTENSIONS,
  getExtensionFromContentType,
  getExtensionFromFilename
};
