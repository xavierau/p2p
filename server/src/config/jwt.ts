import crypto from 'crypto';

/**
 * JWT Configuration
 *
 * Centralizes all JWT-related configuration with strong security defaults.
 * Uses separate secrets for access and refresh tokens when available.
 */
export const jwtConfig = {
  /** Secret for signing access tokens */
  get accessTokenSecret(): string {
    return process.env.JWT_SECRET!;
  },

  /** Secret for signing refresh tokens (falls back to JWT_SECRET if not set) */
  get refreshTokenSecret(): string {
    return process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET!;
  },

  /** Access token validity duration */
  accessTokenExpiry: '15m' as const,

  /** Access token validity in seconds (for response payload) */
  accessTokenExpirySeconds: 15 * 60,

  /** Refresh token validity in days */
  refreshTokenExpiryDays: 7,

  /** JWT issuer claim - identifies who created the token */
  issuer: 'payment-management-api',

  /** JWT audience claim - identifies intended recipient */
  audience: 'payment-management-client',
};

/** Minimum length for JWT secrets to ensure security */
const MIN_SECRET_LENGTH = 32;

/** Known weak/default secret values that should never be used */
const WEAK_SECRETS = [
  'secret',
  'password',
  'jwt-secret',
  'your-secret',
  'changeme',
  'your-super-secret',
  'change-in-production',
  'test',
  'development',
];

/**
 * Validates JWT configuration at application startup.
 * Throws an error if configuration is invalid or insecure.
 *
 * @throws Error if JWT configuration is missing or insecure
 */
export const validateJwtConfig = (): void => {
  const errors: string[] = [];

  // Validate JWT_SECRET exists
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable is required');
  } else {
    // Validate minimum length
    if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
      errors.push(
        `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters for security (current: ${process.env.JWT_SECRET.length})`
      );
    }

    // Check for weak/default secrets
    const normalizedSecret = process.env.JWT_SECRET.toLowerCase();
    const foundWeakPattern = WEAK_SECRETS.find((weak) => normalizedSecret.includes(weak));
    if (foundWeakPattern) {
      errors.push(
        `JWT_SECRET appears to contain a weak/default value ('${foundWeakPattern}'). Please use a strong random secret.`
      );
    }
  }

  // Validate JWT_REFRESH_SECRET if provided
  if (process.env.JWT_REFRESH_SECRET) {
    if (process.env.JWT_REFRESH_SECRET.length < MIN_SECRET_LENGTH) {
      errors.push(
        `JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters for security (current: ${process.env.JWT_REFRESH_SECRET.length})`
      );
    }

    const normalizedRefreshSecret = process.env.JWT_REFRESH_SECRET.toLowerCase();
    const foundWeakRefreshPattern = WEAK_SECRETS.find((weak) => normalizedRefreshSecret.includes(weak));
    if (foundWeakRefreshPattern) {
      errors.push(
        `JWT_REFRESH_SECRET appears to contain a weak/default value ('${foundWeakRefreshPattern}'). Please use a strong random secret.`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(`JWT Configuration Error:\n${errors.join('\n')}`);
  }
};

/**
 * Generates a cryptographically secure random secret.
 * Use this to generate JWT_SECRET and JWT_REFRESH_SECRET values.
 *
 * @param bytes - Number of random bytes (default: 64, produces 128 hex characters)
 * @returns Hex-encoded random string
 *
 * @example
 * // Generate from command line:
 * // node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
 */
export const generateSecureSecret = (bytes: number = 64): string => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Type-safe JWT payload interface
 */
export interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
}

export default jwtConfig;
