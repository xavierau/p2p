import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateJwtConfig, generateSecureSecret, jwtConfig } from '../../config/jwt';

describe('JWT Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  // ==========================================================================
  // validateJwtConfig
  // ==========================================================================
  describe('validateJwtConfig', () => {
    describe('JWT_SECRET validation', () => {
      it('should throw error when JWT_SECRET is missing', () => {
        // Arrange
        delete process.env.JWT_SECRET;

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow('JWT_SECRET environment variable is required');
      });

      it('should throw error when JWT_SECRET is empty', () => {
        // Arrange
        process.env.JWT_SECRET = '';

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow('JWT_SECRET environment variable is required');
      });

      it('should throw error when JWT_SECRET is too short', () => {
        // Arrange
        process.env.JWT_SECRET = 'short';

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(
          'JWT_SECRET must be at least 32 characters for security'
        );
      });

      it('should throw error when JWT_SECRET is exactly 31 characters', () => {
        // Arrange
        process.env.JWT_SECRET = 'a'.repeat(31);

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(
          'JWT_SECRET must be at least 32 characters for security'
        );
      });

      it('should pass when JWT_SECRET is exactly 32 characters', () => {
        // Arrange
        process.env.JWT_SECRET = 'a'.repeat(32);

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });

      it('should pass when JWT_SECRET is longer than 32 characters', () => {
        // Arrange
        process.env.JWT_SECRET = generateSecureSecret();

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });
    });

    describe('weak secret detection', () => {
      const weakPatterns = [
        'my-secret-key-that-is-long-enough',
        'password1234567890123456789012',
        'jwt-secret-key-should-not-work',
        'your-secret-is-too-obvious-here',
        'changeme-please-this-is-unsafe',
        'this-contains-test-which-is-bad',
        'development-mode-secret-key-here',
        'your-super-secret-key-is-weak',
        'change-in-production-please-now',
      ];

      it.each(weakPatterns)('should throw error for weak secret: %s', (weakSecret) => {
        // Arrange
        process.env.JWT_SECRET = weakSecret;

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(
          /JWT_SECRET appears to contain a weak\/default value/
        );
      });

      it('should pass for strong random secret', () => {
        // Arrange
        process.env.JWT_SECRET = generateSecureSecret();

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });

      it('should pass for hex string without weak patterns', () => {
        // Arrange
        process.env.JWT_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });
    });

    describe('JWT_REFRESH_SECRET validation', () => {
      beforeEach(() => {
        // Set a valid JWT_SECRET for these tests
        process.env.JWT_SECRET = generateSecureSecret();
      });

      it('should pass when JWT_REFRESH_SECRET is not provided', () => {
        // Arrange
        delete process.env.JWT_REFRESH_SECRET;

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });

      it('should throw error when JWT_REFRESH_SECRET is too short', () => {
        // Arrange
        process.env.JWT_REFRESH_SECRET = 'short';

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(
          'JWT_REFRESH_SECRET must be at least 32 characters for security'
        );
      });

      it('should throw error when JWT_REFRESH_SECRET contains weak pattern', () => {
        // Arrange
        process.env.JWT_REFRESH_SECRET = 'my-secret-refresh-token-key-here';

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(
          /JWT_REFRESH_SECRET appears to contain a weak\/default value/
        );
      });

      it('should pass when JWT_REFRESH_SECRET is valid', () => {
        // Arrange
        process.env.JWT_REFRESH_SECRET = generateSecureSecret();

        // Act & Assert
        expect(() => validateJwtConfig()).not.toThrow();
      });
    });

    describe('multiple errors', () => {
      it('should report all validation errors at once', () => {
        // Arrange
        process.env.JWT_SECRET = 'short';
        process.env.JWT_REFRESH_SECRET = 'also-short';

        // Act & Assert
        expect(() => validateJwtConfig()).toThrow(/JWT_SECRET must be at least/);
      });
    });
  });

  // ==========================================================================
  // generateSecureSecret
  // ==========================================================================
  describe('generateSecureSecret', () => {
    it('should generate a 128-character hex string by default (64 bytes)', () => {
      // Act
      const secret = generateSecureSecret();

      // Assert
      expect(secret).toHaveLength(128);
      expect(secret).toMatch(/^[a-f0-9]{128}$/);
    });

    it('should generate different secrets on each call', () => {
      // Act
      const secret1 = generateSecureSecret();
      const secret2 = generateSecureSecret();

      // Assert
      expect(secret1).not.toBe(secret2);
    });

    it('should generate hex string of specified byte length', () => {
      // Act
      const secret32 = generateSecureSecret(32);
      const secret16 = generateSecureSecret(16);

      // Assert
      expect(secret32).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(secret16).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('should only contain valid hex characters', () => {
      // Act
      const secret = generateSecureSecret();

      // Assert - should only contain 0-9, a-f (lowercase)
      expect(secret).toMatch(/^[a-f0-9]+$/);
    });
  });

  // ==========================================================================
  // jwtConfig object
  // ==========================================================================
  describe('jwtConfig', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = generateSecureSecret();
    });

    it('should return JWT_SECRET as accessTokenSecret', () => {
      // Assert
      expect(jwtConfig.accessTokenSecret).toBe(process.env.JWT_SECRET);
    });

    it('should return JWT_REFRESH_SECRET as refreshTokenSecret when set', () => {
      // Arrange
      const refreshSecret = generateSecureSecret();
      process.env.JWT_REFRESH_SECRET = refreshSecret;

      // Assert
      expect(jwtConfig.refreshTokenSecret).toBe(refreshSecret);
    });

    it('should fall back to JWT_SECRET for refreshTokenSecret when JWT_REFRESH_SECRET not set', () => {
      // Arrange
      delete process.env.JWT_REFRESH_SECRET;

      // Assert
      expect(jwtConfig.refreshTokenSecret).toBe(process.env.JWT_SECRET);
    });

    it('should have correct default values', () => {
      // Assert
      expect(jwtConfig.accessTokenExpiry).toBe('15m');
      expect(jwtConfig.accessTokenExpirySeconds).toBe(900);
      expect(jwtConfig.refreshTokenExpiryDays).toBe(7);
      expect(jwtConfig.issuer).toBe('payment-management-api');
      expect(jwtConfig.audience).toBe('payment-management-client');
    });
  });
});
