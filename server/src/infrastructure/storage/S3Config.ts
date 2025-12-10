/**
 * S3 Configuration from environment variables.
 * Centralized configuration for AWS S3 or S3-compatible storage.
 */
export interface S3Config {
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // Optional for S3-compatible services like MinIO
  forcePathStyle?: boolean; // Required for MinIO and some S3-compatible services
}

/**
 * Loads S3 configuration from environment variables.
 * @throws Error if required environment variables are missing
 */
export function loadS3Config(): S3Config {
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.S3_ENDPOINT; // For MinIO or custom S3-compatible services
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

  if (!region) {
    throw new Error('AWS_REGION or AWS_DEFAULT_REGION environment variable is required');
  }

  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is required');
  }

  if (!accessKeyId) {
    throw new Error('AWS_ACCESS_KEY_ID environment variable is required');
  }

  if (!secretAccessKey) {
    throw new Error('AWS_SECRET_ACCESS_KEY environment variable is required');
  }

  return {
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    endpoint,
    forcePathStyle,
  };
}

/**
 * Validates S3 configuration.
 * @throws Error if configuration is invalid
 */
export function validateS3Config(config: S3Config): void {
  if (!config.region || config.region.trim() === '') {
    throw new Error('S3 region cannot be empty');
  }

  if (!config.bucket || config.bucket.trim() === '') {
    throw new Error('S3 bucket cannot be empty');
  }

  if (!config.accessKeyId || config.accessKeyId.trim() === '') {
    throw new Error('S3 access key ID cannot be empty');
  }

  if (!config.secretAccessKey || config.secretAccessKey.trim() === '') {
    throw new Error('S3 secret access key cannot be empty');
  }
}
