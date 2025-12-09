import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import prisma from '../prisma';
import logger from '../utils/logger';
import { jwtConfig } from '../config/jwt';

// Constants (security-related, not from config)
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}

/**
 * Generates a new access token and refresh token pair for a user.
 * Updates the user's refresh token in the database.
 *
 * @param userId - The ID of the user to generate tokens for
 * @returns TokenPair containing access token, refresh token, and expiry info
 */
export const generateTokenPair = async (userId: number): Promise<TokenPair> => {
  // Generate access token (short-lived JWT) with issuer and audience claims
  const accessToken = jwt.sign({ userId }, jwtConfig.accessTokenSecret, {
    expiresIn: jwtConfig.accessTokenExpiry,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  });

  // Generate refresh token (random bytes, stored hashed in DB)
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);

  // Calculate refresh token expiry
  const refreshTokenExpiresAt = new Date(
    Date.now() + jwtConfig.refreshTokenExpiryDays * 24 * 60 * 60 * 1000
  );

  // Update user with new refresh token and reset login attempts
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: hashedRefreshToken,
      refreshTokenExpiresAt,
      lastLoginAt: new Date(),
      loginAttempts: 0,
      lockedUntil: null,
    },
  });

  logger.debug({ userId }, 'Generated new token pair');

  return {
    accessToken,
    refreshToken,
    expiresIn: jwtConfig.accessTokenExpirySeconds,
  };
};

/**
 * Refreshes an access token using a valid refresh token.
 * Implements token rotation - old refresh token is invalidated and new one issued.
 *
 * @param refreshToken - The refresh token from the httpOnly cookie
 * @returns New TokenPair
 * @throws Error if refresh token is invalid or expired
 */
export const refreshAccessToken = async (refreshToken: string): Promise<TokenPair> => {
  // Find all users with non-expired refresh tokens
  // We need to check the hash against each one since we can't query by the plain token
  const usersWithTokens = await prisma.user.findMany({
    where: {
      refreshToken: { not: null },
      refreshTokenExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      refreshToken: true,
      refreshTokenExpiresAt: true,
    },
  });

  // Find the user whose hashed refresh token matches
  let matchedUserId: number | null = null;

  for (const user of usersWithTokens) {
    if (user.refreshToken) {
      const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
      if (isMatch) {
        matchedUserId = user.id;
        break;
      }
    }
  }

  if (!matchedUserId) {
    logger.warn('Invalid refresh token attempt');
    throw new Error('Invalid refresh token');
  }

  // Token rotation: generate new token pair
  // This invalidates the old refresh token
  const newTokens = await generateTokenPair(matchedUserId);

  logger.info({ userId: matchedUserId }, 'Refresh token rotated successfully');

  return newTokens;
};

/**
 * Revokes a user's refresh token (logout).
 *
 * @param userId - The ID of the user to revoke tokens for
 */
export const revokeRefreshToken = async (userId: number): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      refreshToken: null,
      refreshTokenExpiresAt: null,
    },
  });

  logger.info({ userId }, 'Refresh token revoked');
};

/**
 * Increments login attempts for a user.
 * Locks the account if max attempts exceeded.
 *
 * @param userId - The ID of the user
 */
export const incrementLoginAttempts = async (userId: number): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { loginAttempts: true },
  });

  if (!user) {
    return;
  }

  const newAttempts = user.loginAttempts + 1;
  const updateData: { loginAttempts: number; lockedUntil?: Date } = {
    loginAttempts: newAttempts,
  };

  // Lock account if max attempts exceeded
  if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
    updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    logger.warn({ userId, attempts: newAttempts }, 'Account locked due to too many failed attempts');
  }

  await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
};

/**
 * Checks if a user's account is currently locked.
 *
 * @param userId - The ID of the user to check
 * @returns true if account is locked, false otherwise
 */
export const isAccountLocked = async (userId: number): Promise<boolean> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });

  if (!user || !user.lockedUntil) {
    return false;
  }

  const isLocked = user.lockedUntil > new Date();

  // Auto-unlock if lockout period has passed
  if (!isLocked && user.lockedUntil) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: null,
        loginAttempts: 0,
      },
    });
  }

  return isLocked;
};

/**
 * Resets login attempts for a user (called on successful login).
 *
 * @param userId - The ID of the user
 */
export const resetLoginAttempts = async (userId: number): Promise<void> => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      loginAttempts: 0,
      lockedUntil: null,
    },
  });
};

/**
 * Gets the remaining lockout time in minutes.
 *
 * @param userId - The ID of the user
 * @returns Minutes remaining, or 0 if not locked
 */
export const getRemainingLockoutTime = async (userId: number): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lockedUntil: true },
  });

  if (!user || !user.lockedUntil) {
    return 0;
  }

  const remainingMs = user.lockedUntil.getTime() - Date.now();
  return remainingMs > 0 ? Math.ceil(remainingMs / 60000) : 0;
};

// Export constants for testing
export const AUTH_CONSTANTS = {
  ACCESS_TOKEN_EXPIRY: jwtConfig.accessTokenExpiry,
  ACCESS_TOKEN_EXPIRY_SECONDS: jwtConfig.accessTokenExpirySeconds,
  REFRESH_TOKEN_EXPIRY_DAYS: jwtConfig.refreshTokenExpiryDays,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_DURATION_MINUTES,
};
