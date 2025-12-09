import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import { getPrismaMock } from '../helpers/prisma-mock';
import { createTestUser, createTestToken } from '../helpers/test-factories';
import { UserRole } from '@prisma/client';

// Get the mocked prisma instance
const prismaMock = getPrismaMock();

// Mock authService for controlled testing
vi.mock('../../services/authService', async () => {
  const actual = await vi.importActual('../../services/authService');
  return {
    ...actual,
    generateTokenPair: vi.fn().mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresIn: 900,
    }),
    refreshAccessToken: vi.fn().mockImplementation(async (token: string) => {
      if (token === 'valid-refresh-token') {
        return {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
          expiresIn: 900,
        };
      }
      throw new Error('Invalid refresh token');
    }),
    revokeRefreshToken: vi.fn().mockResolvedValue(undefined),
    incrementLoginAttempts: vi.fn().mockResolvedValue(undefined),
    isAccountLocked: vi.fn().mockResolvedValue(false),
    getRemainingLockoutTime: vi.fn().mockResolvedValue(0),
  };
});

// Import after mocks are set up
import authRouter from '../../routes/auth';
import { errorHandler } from '../../middleware/errorHandler';
import {
  generateTokenPair,
  refreshAccessToken,
  revokeRefreshToken,
  incrementLoginAttempts,
  isAccountLocked,
  getRemainingLockoutTime,
} from '../../services/authService';

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', authRouter);
    // Error handler must be added AFTER routes
    app.use(errorHandler);
  });

  // ==========================================================================
  // POST /api/auth/register
  // ==========================================================================
  describe('POST /api/auth/register', () => {
    const validRegistration = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User',
    };

    it('should register a new user with valid data', async () => {
      // Arrange
      prismaMock.user.create.mockResolvedValue(
        createTestUser({
          id: 1,
          email: 'test@example.com',
          name: 'Test User',
        }) as any
      );

      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User created successfully');
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          password: expect.any(String), // Hashed password
        }),
      });
    });

    it('should hash the password before storing', async () => {
      // Arrange
      prismaMock.user.create.mockResolvedValue(createTestUser() as any);

      // Act
      await request(app)
        .post('/api/auth/register')
        .send(validRegistration);

      // Assert
      const createCall = prismaMock.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe('SecurePass123!');
      expect(createCall.data.password.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    describe('password validation', () => {
      it('should reject password shorter than 12 characters', async () => {
        // Act
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'Short123!',
          });

        // Assert
        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('should reject password without uppercase letter', async () => {
        // Act
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'nouppercase123!',
          });

        // Assert
        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('should reject password without lowercase letter', async () => {
        // Act
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'NOLOWERCASE123!',
          });

        // Assert
        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('should reject password without digit', async () => {
        // Act
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'NoDigitsHere!!',
          });

        // Assert
        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });

      it('should reject password without special character', async () => {
        // Act
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            ...validRegistration,
            password: 'NoSpecialChar123',
          });

        // Assert
        expect(response.status).toBe(400);
        expect(prismaMock.user.create).not.toHaveBeenCalled();
      });
    });

    it('should reject invalid email format', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          email: 'not-an-email',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('should reject empty name', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistration,
          name: '',
        });

      // Assert
      expect(response.status).toBe(400);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it('should reject missing required fields', async () => {
      // Act - missing email
      const response1 = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'SecurePass123!',
          name: 'Test',
        });

      // Act - missing password
      const response2 = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test',
        });

      // Assert
      expect(response1.status).toBe(400);
      expect(response2.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /api/auth/login
  // ==========================================================================
  describe('POST /api/auth/login', () => {
    const validLogin = {
      email: 'test@example.com',
      password: 'SecurePass123!',
    };

    it('should login successfully and return access token with cookie', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
        name: 'Test User',
        role: UserRole.USER,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBe('test-access-token');
      expect(response.body.expiresIn).toBe(900);
      expect(response.body.user).toEqual({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      });

      // Verify cookie was set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=test-refresh-token');
      expect(cookies[0]).toContain('HttpOnly');
      expect(cookies[0]).toContain('Path=/api/auth');
    });

    it('should return 400 for non-existent user', async () => {
      // Arrange
      prismaMock.user.findUnique.mockResolvedValue(null);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 for wrong password and increment attempts', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('DifferentPassword123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid credentials');
      expect(incrementLoginAttempts).toHaveBeenCalledWith(1);
    });

    it('should return 423 when account is locked', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);
      vi.mocked(isAccountLocked).mockResolvedValue(true);
      vi.mocked(getRemainingLockoutTime).mockResolvedValue(10);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Assert
      expect(response.status).toBe(423);
      expect(response.body.error).toBe('Account temporarily locked');
      expect(response.body.message).toContain('10 minutes');
      expect(response.body.retryAfter).toBe(600);
    });

    it('should use generic error message to prevent user enumeration', async () => {
      // Arrange - user not found
      prismaMock.user.findUnique.mockResolvedValue(null);
      vi.mocked(isAccountLocked).mockResolvedValue(false);

      // Act
      const responseNotFound = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Arrange - wrong password
      const hashedPassword = await bcrypt.hash('DifferentPassword123!', 12);
      prismaMock.user.findUnique.mockResolvedValue(
        createTestUser({ password: hashedPassword }) as any
      );
      vi.mocked(isAccountLocked).mockResolvedValue(false);

      const responseWrongPassword = await request(app)
        .post('/api/auth/login')
        .send(validLogin);

      // Assert - same error message for both cases
      expect(responseNotFound.body.error).toBe('Invalid credentials');
      expect(responseWrongPassword.body.error).toBe('Invalid credentials');
    });

    it('should reject invalid email format', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: 'password',
        });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should reject empty password', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: '',
        });

      // Assert
      expect(response.status).toBe(400);
    });

    it('should include user role in response', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'admin@example.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);
      vi.mocked(isAccountLocked).mockResolvedValue(false);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'SecurePass123!' });

      // Assert
      expect(response.body.user.role).toBe('ADMIN');
    });
  });

  // ==========================================================================
  // POST /api/auth/refresh
  // ==========================================================================
  describe('POST /api/auth/refresh', () => {
    it('should return new access token with valid refresh cookie', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.accessToken).toBe('new-access-token');
      expect(response.body.expiresIn).toBe(900);

      // Verify new refresh token cookie was set (rotation)
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=new-refresh-token');
    });

    it('should return 401 when no refresh token cookie', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Refresh token required');
    });

    it('should return 401 and clear cookie for invalid refresh token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token');

      // Assert
      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');

      // Verify cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('Expires=');
    });

    it('should implement token rotation', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token');

      // Assert
      expect(refreshAccessToken).toHaveBeenCalledWith('valid-refresh-token');

      // New refresh token should be different
      const cookies = response.headers['set-cookie'];
      expect(cookies[0]).toContain('refreshToken=new-refresh-token');
    });
  });

  // ==========================================================================
  // POST /api/auth/logout
  // ==========================================================================
  describe('POST /api/auth/logout', () => {
    it('should logout and clear refresh token', async () => {
      // Arrange
      const user = createTestUser({ id: 1 });
      prismaMock.user.findUnique.mockResolvedValue(user as any);
      const token = createTestToken(1);

      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);

      // Assert
      expect(response.status).toBe(204);
      expect(revokeRefreshToken).toHaveBeenCalledWith(1);

      // Verify cookie was cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
      expect(cookies[0]).toContain('Expires=');
    });

    it('should return 401 without access token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout');

      // Assert
      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid access token', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      // Assert
      expect(response.status).toBe(403);
    });
  });

  // ==========================================================================
  // POST /api/auth/forgot-password
  // ==========================================================================
  describe('POST /api/auth/forgot-password', () => {
    it('should return success message for valid email', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'If an account exists with this email, you will receive a password reset link.'
      );
    });

    it('should return same message for non-existent email (prevent enumeration)', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.message).toBe(
        'If an account exists with this email, you will receive a password reset link.'
      );
    });

    it('should reject invalid email format', async () => {
      // Act
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      // Assert
      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // Account Lockout Integration Tests
  // ==========================================================================
  describe('Account Lockout Flow', () => {
    it('should lock account after 5 failed login attempts', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('CorrectPass123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);
      vi.mocked(isAccountLocked).mockResolvedValue(false);

      // Act - 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({ email: 'test@example.com', password: 'WrongPass123!' });
      }

      // Assert
      expect(incrementLoginAttempts).toHaveBeenCalledTimes(5);
    });

    it('should prevent login when account is locked', async () => {
      // Arrange
      const hashedPassword = await bcrypt.hash('SecurePass123!', 12);
      const user = createTestUser({
        id: 1,
        email: 'test@example.com',
        password: hashedPassword,
      });
      prismaMock.user.findUnique.mockResolvedValue(user as any);
      vi.mocked(isAccountLocked).mockResolvedValue(true);
      vi.mocked(getRemainingLockoutTime).mockResolvedValue(15);

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123!' });

      // Assert
      expect(response.status).toBe(423);
      expect(response.body.message).toContain('15 minutes');
    });
  });
});
