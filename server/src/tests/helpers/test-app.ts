import express, { Express } from 'express';
import { createTestToken, getTestJwtSecret, getTestJwtIssuer, getTestJwtAudience } from './test-factories';

/**
 * Creates an Express app configured for testing.
 * This sets up basic middleware without rate limiting or other production features.
 */
export const createTestApp = (): Express => {
  const app = express();
  app.use(express.json());
  return app;
};

/**
 * Creates an authorization header with a valid JWT token for the given user ID.
 */
export const createAuthHeader = (userId: number): { Authorization: string } => {
  const token = createTestToken(userId);
  return { Authorization: `Bearer ${token}` };
};

/**
 * Creates an invalid authorization header for testing unauthorized access.
 */
export const createInvalidAuthHeader = (): { Authorization: string } => {
  return { Authorization: 'Bearer invalid-token' };
};

/**
 * Creates an expired authorization header for testing token expiration.
 */
export const createExpiredAuthHeader = (): { Authorization: string } => {
  // This creates a token with an already expired timestamp
  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { userId: 1, iat: Math.floor(Date.now() / 1000) - 7200 }, // 2 hours ago
    getTestJwtSecret(),
    {
      expiresIn: '1s', // Already expired
      issuer: getTestJwtIssuer(),
      audience: getTestJwtAudience(),
    }
  );
  return { Authorization: `Bearer ${token}` };
};
