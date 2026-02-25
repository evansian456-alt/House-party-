/**
 * S3-Compatible Storage Provider
 * 
 * Stores uploaded tracks in S3-compatible object storage (AWS S3, Railway Buckets, Cloudflare R2, etc.)
 * Required for production multi-instance deployments on Railway.
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const { getExtensionFromContentType, getExtensionFromFilename } = require('./utils');

/**
 * Sanitize a string for use in S3 metadata headers.
 * Replaces non-ASCII characters with "_" and truncates to 100 chars.
 * \x20-\x7E covers the ASCII printable range (space through tilde).
 * @param {string} value
 * @returns {string}
 */
function sanitizeMetadataValue(value) {
  if (!value) return '';
  // Replace non-ASCII with underscore
  const ascii = value.replace(/[^\x20-\x7E]/g, '_');
  // Truncate to 100 chars
  return ascii.slice(0, 100);
}

class S3Provider {
  constructor() {
    this.bucket = process.env.S3_BUCKET;
    // Normalize prefix: if set and non-empty, ensure it ends with "/"
    const rawPrefix = process.env.S3_PREFIX;
    if (rawPrefix === undefined || rawPrefix === null) {
      this.prefix = 'tracks/';
    } else if (rawPrefix === '') {
      this.prefix = '';
    } else {
      this.prefix = rawPrefix.endsWith('/') ? rawPrefix : `${rawPrefix}/`;
    }
    this.region = process.env.S3_REGION || 'auto';
    this.endpoint = process.env.S3_ENDPOINT || undefined;
    this.forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';
    
    // Metadata cache (optional, for performance)
    this.metadataCache = new Map();
  }

  async init() {
    // Validate required configuration
    if (!this.bucket) {
      throw new Error('S3_BUCKET is required');
    }
    if (!process.env.S3_ACCESS_KEY_ID) {
      throw new Error('S3_ACCESS_KEY_ID is required');
    }
    if (!process.env.S3_SECRET_ACCESS_KEY) {
      throw new Error('S3_SECRET_ACCESS_KEY is required');
    }

    // Initialize S3 client
    const clientConfig = {
      region: this.region,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY
      },
      forcePathStyle: this.forcePathStyle
    };

    // Add endpoint for R2/Railway/non-AWS
    if (this.endpoint) {
      clientConfig.endpoint = this.endpoint;
    }

    this.client = new S3Client(clientConfig);

    console.log('[S3] Initialized S3 provider');
    console.log(`[S3] Bucket: ${this.bucket}`);
    console.log(`[S3] Region: ${this.region}`);
    console.log(`[S3] Prefix: ${this.prefix}`);
    if (this.endpoint) {
      console.log(`[S3] Endpoint: ${this.endpoint}`);
    }
    console.log(`[S3] Force path style: ${this.forcePathStyle}`);
  }

  /**
   * Generate S3 key for a track
   */
  _getKey(trackId, ext = '') {
    return `${this.prefix}${trackId}${ext}`;
  }

  /**
   * Upload a file
   * @param {string} trackId - Unique track identifier
   * @param {Buffer|Stream} fileData - File data or readable stream
   * @param {object} metadata - { contentType, originalName, size }
   * @returns {Promise<object>} - { key, contentType, size }
   */
  async upload(trackId, fileData, metadata) {
    const ext = getExtensionFromContentType(metadata.contentType) || 
                getExtensionFromFilename(metadata.originalName) || 
                '.bin';
    const key = this._getKey(trackId, ext);

    try {
      if (Buffer.isBuffer(fileData)) {
        // Upload buffer directly
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: fileData,
          ContentType: metadata.contentType,
          Metadata: {
            trackId,
            originalName: sanitizeMetadataValue(metadata.originalName),
            uploadedAt: Date.now().toString()
          }
        });
        await this.client.send(command);
        
        console.log(`[S3] Uploaded track ${trackId} (${fileData.length} bytes) to ${key}`);
        
        return {
          key,
          contentType: metadata.contentType,
          size: fileData.length
        };
      } else if (fileData.pipe || fileData.readable) {
        // Upload stream using multipart upload
        const upload = new Upload({
          client: this.client,
          params: {
            Bucket: this.bucket,
            Key: key,
            Body: fileData,
            ContentType: metadata.contentType,
            Metadata: {
              trackId,
              originalName: sanitizeMetadataValue(metadata.originalName),
              uploadedAt: Date.now().toString()
            }
          }
        });

        const result = await upload.done();
        
        // Get actual size from S3
        const headCommand = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        });
        const headResult = await this.client.send(headCommand);
        const actualSize = headResult.ContentLength || metadata.size || 0;

        console.log(`[S3] Uploaded track ${trackId} (${actualSize} bytes) to ${key}`);

        // Cache metadata
        this.metadataCache.set(trackId, {
          key,
          contentType: metadata.contentType,
          size: actualSize,
          createdAt: Date.now()
        });

        return {
          key,
          contentType: metadata.contentType,
          size: actualSize
        };
      } else {
        throw new Error('fileData must be Buffer or Stream');
      }
    } catch (err) {
      console.error(`[S3] Upload error for track ${trackId}:`, err.message);
      throw err;
    }
  }

  /**
   * PHASE 2: Generate presigned PUT URL for direct-to-R2 upload
   * @param {string} trackId - Unique track identifier
   * @param {object} metadata - { contentType, originalName }
   * @returns {Promise<object>} - { putUrl, key }
   */
  async generatePresignedPutUrl(trackId, metadata) {
    const ext = getExtensionFromContentType(metadata.contentType) || 
                getExtensionFromFilename(metadata.originalName) || 
                '.mp3';
    const key = this._getKey(trackId, ext);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: metadata.contentType,
        Metadata: {
          trackId,
          originalName: sanitizeMetadataValue(metadata.originalName),
          uploadedAt: Date.now().toString()
        }
      });

      // Generate presigned URL valid for 15 minutes
      const putUrl = await getSignedUrl(this.client, command, { expiresIn: 900 });

      console.log(`[S3] Generated presigned PUT URL for track ${trackId}, key: ${key}`);

      return { putUrl, key };
    } catch (err) {
      console.error(`[S3] Error generating presigned URL for track ${trackId}:`, err.message);
      throw err;
    }
  }

  /**
   * Get file metadata
   * @param {string} trackId - Unique track identifier
   * @returns {Promise<object|null>} - { key, contentType, size, createdAt } or null if not found
   */
  async getMetadata(trackId) {
    // Check cache first
    if (this.metadataCache.has(trackId)) {
      return this.metadataCache.get(trackId);
    }

    // Try all common extensions
    const extensions = ['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.flac', '.aac', ''];
    
    for (const ext of extensions) {
      const key = this._getKey(trackId, ext);
      
      try {
        const command = new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key
        });
        const result = await this.client.send(command);

        const meta = {
          key,
          contentType: result.ContentType || 'application/octet-stream',
          size: result.ContentLength || 0,
          createdAt: result.LastModified ? result.LastModified.getTime() : Date.now()
        };

        // Cache it
        this.metadataCache.set(trackId, meta);

        return meta;
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          // Try next extension
          continue;
        }
        console.error(`[S3] Error getting metadata for ${key}:`, err.message);
        throw err;
      }
    }

    console.log(`[S3] Track ${trackId} not found`);
    return null;
  }

  /**
   * Stream file with Range support
   * @param {string} trackId - Unique track identifier
   * @param {object} options - { start, end } for range requests
   * @returns {Promise<object|null>} - { stream, contentType, size, contentRange } or null if not found
   */
  async stream(trackId, options = {}) {
    const meta = await this.getMetadata(trackId);
    if (!meta) return null;

    const { start, end } = options;
    const fileSize = meta.size;

    try {
      const commandParams = {
        Bucket: this.bucket,
        Key: meta.key
      };

      // Add Range header if requested
      if (start !== undefined || end !== undefined) {
        const rangeStart = start || 0;
        const rangeEnd = end !== undefined ? end : fileSize - 1;
        commandParams.Range = `bytes=${rangeStart}-${rangeEnd}`;
      }

      const command = new GetObjectCommand(commandParams);
      const response = await this.client.send(command);

      return {
        stream: response.Body,
        contentType: response.ContentType || meta.contentType,
        size: response.ContentLength || meta.size,
        contentRange: response.ContentRange || null,
        acceptRanges: response.AcceptRanges || 'bytes'
      };
    } catch (err) {
      console.error(`[S3] Error streaming track ${trackId}:`, err.message);
      throw err;
    }
  }

  /**
   * Delete a file
   * @param {string} trackId - Unique track identifier
   * @returns {Promise<boolean>} - true if deleted, false if not found
   */
  async delete(trackId) {
    const meta = await this.getMetadata(trackId);
    if (!meta) {
      console.log(`[S3] Track ${trackId} not found for deletion`);
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: meta.key
      });
      await this.client.send(command);
      
      console.log(`[S3] Deleted track ${trackId} (key: ${meta.key})`);
      
      // Remove from cache
      this.metadataCache.delete(trackId);
      
      return true;
    } catch (err) {
      console.error(`[S3] Error deleting track ${trackId}:`, err.message);
      throw err;
    }
  }
}

module.exports = S3Provider;
