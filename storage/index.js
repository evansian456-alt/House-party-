/**
 * Storage Provider Abstraction
 * 
 * Chooses between local disk storage (dev) and S3-compatible storage (production).
 * Production on Railway requires S3-compatible storage for multi-instance deployments.
 */

// Check if S3 configuration is present
function hasS3Config() {
  return !!(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  );
}

// Check if we're in production mode
function isProduction() {
  return process.env.NODE_ENV === 'production' || 
         !!process.env.RAILWAY_ENVIRONMENT;
}

// Select and initialize storage provider
async function initStorage() {
  const useS3 = hasS3Config();
  const isProd = isProduction();
  const allowLocalInProd = process.env.ALLOW_LOCAL_DISK_IN_PROD === 'true';
  
  console.log('[Storage] Initializing storage provider...');
  console.log(`[Storage] Environment: ${isProd ? 'production' : 'development'}`);
  console.log(`[Storage] S3 configured: ${useS3}`);
  
  if (useS3) {
    // Use S3 provider
    console.log('[Storage] Using S3-compatible storage');
    const S3Provider = require('./s3');
    const provider = new S3Provider();
    await provider.init();
    return provider;
  } else {
    // Use local disk provider
    if (isProd && !allowLocalInProd) {
      const error = new Error(
        'FATAL: S3 storage is required in production but not configured. ' +
        'Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_ENDPOINT. ' +
        'Alternatively, set ALLOW_LOCAL_DISK_IN_PROD=true (not recommended for multi-instance deployments).'
      );
      console.error('[Storage]', error.message);
      throw error;
    }
    
    if (isProd && allowLocalInProd) {
      console.warn('[Storage] ⚠️  WARNING: Using local disk storage in production. This is NOT recommended for multi-instance deployments.');
    }
    
    console.log('[Storage] Using local disk storage');
    const LocalDiskProvider = require('./localDisk');
    const provider = new LocalDiskProvider();
    await provider.init();
    return provider;
  }
}

module.exports = { initStorage };
