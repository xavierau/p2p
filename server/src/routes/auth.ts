import express from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import { asyncHandler } from '../utils/asyncHandler';
import { RegisterSchema, LoginSchema, ForgotPasswordSchema } from '../schemas';
import logger from '../utils/logger';
import { authLoginTotal, authRefreshTotal } from '../services/metricsService';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types/auth';
import {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  incrementLoginAttempts,
  isAccountLocked,
  getRemainingLockoutTime,
} from '../services/authService';
import { generateCsrfToken, CSRF_COOKIE_NAME } from '../middleware/csrf';

const router = express.Router();

// Cookie configuration
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

/**
 * POST /api/auth/register
 * Register a new user account.
 *
 * Body:
 * - email: Valid email format
 * - password: Min 12 chars, uppercase, lowercase, digit, special char
 * - name: User's display name
 */
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const validatedData = RegisterSchema.parse(req.body);

    const hashedPassword = await bcrypt.hash(validatedData.password, 12);
    await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
      },
    });

    logger.info({ email: validatedData.email }, 'User registered successfully');
    res.status(201).json({ message: 'User created successfully' });
  })
);

/**
 * POST /api/auth/login
 * Authenticate user and return access token (refresh token in httpOnly cookie).
 *
 * Body:
 * - email: Valid email format
 * - password: User's password
 *
 * Returns:
 * - accessToken: JWT token (15 min expiry)
 * - expiresIn: Seconds until access token expires
 * - user: User profile (id, email, name, role)
 *
 * Sets:
 * - refreshToken cookie (httpOnly, 7 day expiry)
 */
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const validatedData = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      // Use generic message to prevent user enumeration
      logger.warn({ email: validatedData.email }, 'Login attempt for non-existent user');
      authLoginTotal.inc({ status: 'failure' });
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    // Check if account is locked
    const locked = await isAccountLocked(user.id);
    if (locked) {
      const remainingMinutes = await getRemainingLockoutTime(user.id);
      logger.warn({ userId: user.id }, 'Login attempt on locked account');
      authLoginTotal.inc({ status: 'locked' });
      res.status(423).json({
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Try again in ${remainingMinutes} minutes.`,
        retryAfter: remainingMinutes * 60,
      });
      return;
    }

    const validPassword = await bcrypt.compare(validatedData.password, user.password);
    if (!validPassword) {
      // Increment failed attempts
      await incrementLoginAttempts(user.id);
      logger.warn({ userId: user.id }, 'Login attempt with invalid password');
      authLoginTotal.inc({ status: 'failure' });
      res.status(400).json({ error: 'Invalid credentials' });
      return;
    }

    // Generate token pair
    const tokens = await generateTokenPair(user.id);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

    authLoginTotal.inc({ status: 'success' });
    logger.info({ userId: user.id }, 'User logged in successfully');

    res.json({
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  })
);

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token from httpOnly cookie.
 * Implements token rotation for security.
 *
 * Returns:
 * - accessToken: New JWT token (15 min expiry)
 * - expiresIn: Seconds until access token expires
 *
 * Sets:
 * - New refreshToken cookie (old one is invalidated)
 */
router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      logger.warn('Refresh attempt without token');
      authRefreshTotal.inc({ status: 'missing_token' });
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    try {
      const tokens = await refreshAccessToken(refreshToken);

      // Set new refresh token cookie (rotation)
      res.cookie('refreshToken', tokens.refreshToken, REFRESH_COOKIE_OPTIONS);

      authRefreshTotal.inc({ status: 'success' });
      res.json({
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      });
    } catch (error) {
      // Clear invalid refresh token cookie
      res.clearCookie('refreshToken', { path: '/api/auth' });
      authRefreshTotal.inc({ status: 'invalid_token' });
      logger.warn({ error }, 'Invalid refresh token');
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  })
);

/**
 * POST /api/auth/logout
 * Logout user by invalidating refresh token and clearing cookie.
 *
 * Requires: Valid access token in Authorization header
 */
router.post(
  '/logout',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res) => {
    const userId = req.user!.userId;

    await revokeRefreshToken(userId);

    res.clearCookie('refreshToken', { path: '/api/auth' });

    logger.info({ userId }, 'User logged out successfully');
    res.status(204).send();
  })
);

/**
 * POST /api/auth/forgot-password
 * Request password reset link.
 *
 * Body:
 * - email: Valid email format
 *
 * Note: Always returns success to prevent user enumeration.
 * In production, this should send an email with reset link.
 */
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const validatedData = ForgotPasswordSchema.parse(req.body);

    // Log the request but don't reveal if email exists
    logger.info({ email: validatedData.email }, 'Password reset requested');

    // In production: lookup user, generate reset token, send email
    // Always return same response to prevent enumeration
    res.json({
      message: 'If an account exists with this email, you will receive a password reset link.',
    });
  })
);

/**
 * GET /api/auth/csrf
 * Get CSRF token for state-changing requests.
 *
 * Returns the CSRF token and sets it as a cookie if not already present.
 * The token must be included in the X-CSRF-Token header for
 * POST, PUT, DELETE, and PATCH requests.
 *
 * Returns:
 * - csrfToken: The CSRF token to include in request headers
 */
router.get('/csrf', (req, res) => {
  let token = req.cookies[CSRF_COOKIE_NAME];

  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });
  }

  res.json({ csrfToken: token });
});

export default router;
