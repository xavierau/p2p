import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 *
 * Implements the Double-Submit Cookie pattern for CSRF protection.
 * This pattern works by:
 * 1. Setting a CSRF token in a cookie (readable by JavaScript)
 * 2. Requiring the same token to be sent in a request header
 * 3. Verifying both values match
 *
 * Since an attacker cannot read cookies from another domain (Same-Origin Policy),
 * they cannot obtain the token to include in the header.
 */

export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/** Safe HTTP methods that don't require CSRF protection */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

/** Paths that are exempt from CSRF protection */
const EXEMPT_PATHS = [
  '/api/auth/refresh', // Uses httpOnly cookie for validation
];

/**
 * Generates a cryptographically secure CSRF token.
 *
 * @returns A random hex string (64 characters = 32 bytes)
 */
export const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * CSRF Protection Middleware
 *
 * Validates that state-changing requests (POST, PUT, DELETE, PATCH)
 * include a valid CSRF token in both cookie and header.
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Skip for safe methods (GET, HEAD, OPTIONS)
  if (SAFE_METHODS.includes(req.method)) {
    return next();
  }

  // Skip for exempt paths
  if (EXEMPT_PATHS.some((path) => req.path === path || req.path.startsWith(path))) {
    return next();
  }

  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  // Both tokens must be present
  if (!cookieToken || !headerToken) {
    res.status(403).json({
      error: 'CSRF token missing',
      message: 'Request must include CSRF token in both cookie and header',
    });
    return;
  }

  // Tokens must match (constant-time comparison to prevent timing attacks)
  if (!constantTimeCompare(cookieToken, headerToken)) {
    res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token mismatch between cookie and header',
    });
    return;
  }

  next();
};

/**
 * Middleware to set CSRF cookie on responses.
 *
 * Sets a CSRF token cookie if one doesn't already exist.
 * The cookie is:
 * - NOT httpOnly (must be readable by JavaScript)
 * - Secure in production (HTTPS only)
 * - SameSite=Strict (most restrictive)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const setCsrfCookie = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.cookies[CSRF_COOKIE_NAME]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }
  next();
};

/**
 * Constant-time string comparison to prevent timing attacks.
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
const constantTimeCompare = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
};
