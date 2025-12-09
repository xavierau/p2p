import { describe, it, expect, beforeEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPrismaMock } from '../helpers/prisma-mock';
import { createTestUser } from '../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Import the service after mocks are set up
import {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  incrementLoginAttempts,
  isAccountLocked,
  resetLoginAttempts,
  getRemainingLockoutTime,
  AUTH_CONSTANTS,
} from '../../services/authService';

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // generateTokenPair
  // ==========================================================================
  describe('generateTokenPair', () => {
    it('should generate valid access and refresh tokens', async () => {
      // Arrange
      const userId = 1;
      const user = createTestUser({ id: userId });
      prismaMock.user.update.mockResolvedValue(user as any);

      // Act
      const result = await generateTokenPair(userId);

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS);

      // Verify access token is a valid JWT
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET!) as { userId: number };
      expect(decoded.userId).toBe(userId);

      // Verify refresh token is a hex string (128 chars = 64 bytes in hex)
      expect(result.refreshToken).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should update user with hashed refresh token', async () => {
      // Arrange
      const userId = 1;
      const user = createTestUser({ id: userId });
      prismaMock.user.update.mockResolvedValue(user as any);

      // Act
      await generateTokenPair(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          refreshToken: expect.any(String),
          refreshTokenExpiresAt: expect.any(Date),
          lastLoginAt: expect.any(Date),
          loginAttempts: 0,
          lockedUntil: null,
        }),
      });

      // Verify the stored token is hashed (bcrypt hashes start with $2a$ or $2b$)
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.refreshToken).toMatch(/^\$2[ab]\$/);
    });

    it('should set refresh token expiry to 7 days from now', async () => {
      // Arrange
      const userId = 1;
      const user = createTestUser({ id: userId });
      prismaMock.user.update.mockResolvedValue(user as any);
      const beforeCall = Date.now();

      // Act
      await generateTokenPair(userId);

      // Assert
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      const expiresAt = updateCall.data.refreshTokenExpiresAt as Date;
      const expectedExpiry = beforeCall + AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiry + 1000);
    });

    it('should reset login attempts on token generation', async () => {
      // Arrange
      const userId = 1;
      const user = createTestUser({ id: userId });
      prismaMock.user.update.mockResolvedValue(user as any);

      // Act
      await generateTokenPair(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          loginAttempts: 0,
          lockedUntil: null,
        }),
      });
    });
  });

  // ==========================================================================
  // refreshAccessToken
  // ==========================================================================
  describe('refreshAccessToken', () => {
    it('should return new tokens for valid refresh token', async () => {
      // Arrange
      const userId = 1;
      const plainRefreshToken = 'a'.repeat(128);
      const hashedToken = await bcrypt.hash(plainRefreshToken, 10);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      prismaMock.user.findMany.mockResolvedValue([
        {
          id: userId,
          refreshToken: hashedToken,
          refreshTokenExpiresAt: futureDate,
        } as any,
      ]);
      prismaMock.user.update.mockResolvedValue(createTestUser({ id: userId }) as any);

      // Act
      const result = await refreshAccessToken(plainRefreshToken);

      // Assert
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRY_SECONDS);
    });

    it('should throw error for invalid refresh token', async () => {
      // Arrange
      prismaMock.user.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(refreshAccessToken('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should throw error for expired refresh token', async () => {
      // Arrange - users with expired tokens are filtered out by the query
      prismaMock.user.findMany.mockResolvedValue([]);

      // Act & Assert
      await expect(refreshAccessToken('any-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should implement token rotation (new token on each refresh)', async () => {
      // Arrange
      const userId = 1;
      const plainRefreshToken = 'b'.repeat(128);
      const hashedToken = await bcrypt.hash(plainRefreshToken, 10);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      prismaMock.user.findMany.mockResolvedValue([
        {
          id: userId,
          refreshToken: hashedToken,
          refreshTokenExpiresAt: futureDate,
        } as any,
      ]);
      prismaMock.user.update.mockResolvedValue(createTestUser({ id: userId }) as any);

      // Act
      const result = await refreshAccessToken(plainRefreshToken);

      // Assert - new refresh token should be different from original
      expect(result.refreshToken).not.toBe(plainRefreshToken);

      // Verify user.update was called to store new hashed token
      expect(prismaMock.user.update).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // revokeRefreshToken
  // ==========================================================================
  describe('revokeRefreshToken', () => {
    it('should clear refresh token and expiry', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.update.mockResolvedValue(createTestUser({ id: userId }) as any);

      // Act
      await revokeRefreshToken(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          refreshToken: null,
          refreshTokenExpiresAt: null,
        },
      });
    });
  });

  // ==========================================================================
  // incrementLoginAttempts
  // ==========================================================================
  describe('incrementLoginAttempts', () => {
    it('should increment login attempts by 1', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        loginAttempts: 2,
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await incrementLoginAttempts(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          loginAttempts: 3,
        }),
      });
    });

    it('should lock account after 5 failed attempts', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        loginAttempts: 4, // Will become 5
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await incrementLoginAttempts(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          loginAttempts: 5,
          lockedUntil: expect.any(Date),
        }),
      });

      // Verify lockout duration is approximately 15 minutes
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      const lockedUntil = updateCall.data.lockedUntil as Date;
      const expectedLockout = Date.now() + AUTH_CONSTANTS.LOCKOUT_DURATION_MINUTES * 60 * 1000;
      expect(lockedUntil.getTime()).toBeGreaterThanOrEqual(expectedLockout - 1000);
      expect(lockedUntil.getTime()).toBeLessThanOrEqual(expectedLockout + 1000);
    });

    it('should not lock account before 5 attempts', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        loginAttempts: 3, // Will become 4
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await incrementLoginAttempts(userId);

      // Assert
      const updateCall = prismaMock.user.update.mock.calls[0][0];
      expect(updateCall.data.lockedUntil).toBeUndefined();
    });

    it('should do nothing if user not found', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      await incrementLoginAttempts(999);

      // Assert
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // isAccountLocked
  // ==========================================================================
  describe('isAccountLocked', () => {
    it('should return true when lockedUntil is in the future', async () => {
      // Arrange
      const userId = 1;
      const futureDate = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: futureDate,
      } as any);

      // Act
      const result = await isAccountLocked(userId);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when lockedUntil is in the past', async () => {
      // Arrange
      const userId = 1;
      const pastDate = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: pastDate,
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      const result = await isAccountLocked(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should auto-unlock and reset attempts when lockout has expired', async () => {
      // Arrange
      const userId = 1;
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: pastDate,
      } as any);
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await isAccountLocked(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          lockedUntil: null,
          loginAttempts: 0,
        },
      });
    });

    it('should return false when lockedUntil is null', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: null,
      } as any);

      // Act
      const result = await isAccountLocked(userId);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false when user not found', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await isAccountLocked(999);

      // Assert
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // resetLoginAttempts
  // ==========================================================================
  describe('resetLoginAttempts', () => {
    it('should reset login attempts and clear lockout', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.update.mockResolvedValue({} as any);

      // Act
      await resetLoginAttempts(userId);

      // Assert
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          loginAttempts: 0,
          lockedUntil: null,
        },
      });
    });
  });

  // ==========================================================================
  // getRemainingLockoutTime
  // ==========================================================================
  describe('getRemainingLockoutTime', () => {
    it('should return remaining minutes when account is locked', async () => {
      // Arrange
      const userId = 1;
      const tenMinutesFromNow = new Date(Date.now() + 10 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: tenMinutesFromNow,
      } as any);

      // Act
      const result = await getRemainingLockoutTime(userId);

      // Assert
      expect(result).toBeGreaterThanOrEqual(9);
      expect(result).toBeLessThanOrEqual(11);
    });

    it('should return 0 when lockout has expired', async () => {
      // Arrange
      const userId = 1;
      const pastDate = new Date(Date.now() - 10 * 60 * 1000);
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: pastDate,
      } as any);

      // Act
      const result = await getRemainingLockoutTime(userId);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when lockedUntil is null', async () => {
      // Arrange
      const userId = 1;
      prismaMock.user.findUnique.mockResolvedValue({
        id: userId,
        lockedUntil: null,
      } as any);

      // Act
      const result = await getRemainingLockoutTime(userId);

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when user not found', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      const result = await getRemainingLockoutTime(999);

      // Assert
      expect(result).toBe(0);
    });
  });
});
