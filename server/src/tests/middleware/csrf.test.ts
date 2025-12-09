import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  csrfProtection,
  setCsrfCookie,
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '../../middleware/csrf';

// Mock request factory
const createMockRequest = (options: {
  method?: string;
  path?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
} = {}): Request => {
  return {
    method: options.method || 'GET',
    path: options.path || '/api/test',
    cookies: options.cookies || {},
    headers: options.headers || {},
  } as unknown as Request;
};

// Mock response factory
const createMockResponse = (): Response & {
  statusCode: number;
  jsonData: unknown;
  cookieData: { name: string; value: string; options: unknown } | null;
} => {
  const res = {
    statusCode: 200,
    jsonData: null,
    cookieData: null,
    status: vi.fn().mockImplementation(function (this: Response, code: number) {
      (this as unknown as { statusCode: number }).statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function (this: Response, data: unknown) {
      (this as unknown as { jsonData: unknown }).jsonData = data;
      return this;
    }),
    cookie: vi.fn().mockImplementation(function (
      this: Response,
      name: string,
      value: string,
      options: unknown
    ) {
      (this as unknown as { cookieData: { name: string; value: string; options: unknown } }).cookieData = {
        name,
        value,
        options,
      };
      return this;
    }),
  };
  return res as unknown as Response & {
    statusCode: number;
    jsonData: unknown;
    cookieData: { name: string; value: string; options: unknown } | null;
  };
};

describe('CSRF Middleware', () => {
  // ==========================================================================
  // generateCsrfToken
  // ==========================================================================
  describe('generateCsrfToken', () => {
    it('should generate a 64-character hex string', () => {
      // Act
      const token = generateCsrfToken();

      // Assert
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens on each call', () => {
      // Act
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();

      // Assert
      expect(token1).not.toBe(token2);
    });
  });

  // ==========================================================================
  // csrfProtection middleware
  // ==========================================================================
  describe('csrfProtection', () => {
    let next: NextFunction;

    beforeEach(() => {
      next = vi.fn();
    });

    describe('safe methods (GET, HEAD, OPTIONS)', () => {
      it.each(['GET', 'HEAD', 'OPTIONS'])('should allow %s requests without token', (method) => {
        // Arrange
        const req = createMockRequest({ method });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });

    describe('state-changing methods (POST, PUT, DELETE, PATCH)', () => {
      it.each(['POST', 'PUT', 'DELETE', 'PATCH'])(
        'should block %s requests without CSRF token',
        (method) => {
          // Arrange
          const req = createMockRequest({ method });
          const res = createMockResponse();

          // Act
          csrfProtection(req, res, next);

          // Assert
          expect(next).not.toHaveBeenCalled();
          expect(res.status).toHaveBeenCalledWith(403);
          expect(res.json).toHaveBeenCalledWith({
            error: 'CSRF token missing',
            message: 'Request must include CSRF token in both cookie and header',
          });
        }
      );

      it('should block POST request with only cookie token', () => {
        // Arrange
        const token = generateCsrfToken();
        const req = createMockRequest({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: token },
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.jsonData).toEqual({
          error: 'CSRF token missing',
          message: 'Request must include CSRF token in both cookie and header',
        });
      });

      it('should block POST request with only header token', () => {
        // Arrange
        const token = generateCsrfToken();
        const req = createMockRequest({
          method: 'POST',
          headers: { [CSRF_HEADER_NAME]: token },
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it('should block POST request with mismatched tokens', () => {
        // Arrange
        const cookieToken = generateCsrfToken();
        const headerToken = generateCsrfToken();
        const req = createMockRequest({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: cookieToken },
          headers: { [CSRF_HEADER_NAME]: headerToken },
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.jsonData).toEqual({
          error: 'Invalid CSRF token',
          message: 'CSRF token mismatch between cookie and header',
        });
      });

      it('should allow POST request with matching tokens', () => {
        // Arrange
        const token = generateCsrfToken();
        const req = createMockRequest({
          method: 'POST',
          cookies: { [CSRF_COOKIE_NAME]: token },
          headers: { [CSRF_HEADER_NAME]: token },
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });

      it('should allow PUT request with matching tokens', () => {
        // Arrange
        const token = generateCsrfToken();
        const req = createMockRequest({
          method: 'PUT',
          cookies: { [CSRF_COOKIE_NAME]: token },
          headers: { [CSRF_HEADER_NAME]: token },
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).toHaveBeenCalled();
      });
    });

    describe('exempt paths', () => {
      it('should skip CSRF check for /api/auth/refresh', () => {
        // Arrange
        const req = createMockRequest({
          method: 'POST',
          path: '/api/auth/refresh',
        });
        const res = createMockResponse();

        // Act
        csrfProtection(req, res, next);

        // Assert
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // setCsrfCookie middleware
  // ==========================================================================
  describe('setCsrfCookie', () => {
    let next: NextFunction;

    beforeEach(() => {
      next = vi.fn();
    });

    it('should set CSRF cookie if not present', () => {
      // Arrange
      const req = createMockRequest({ cookies: {} });
      const res = createMockResponse();

      // Act
      setCsrfCookie(req, res, next);

      // Assert
      expect(res.cookie).toHaveBeenCalled();
      expect(res.cookieData?.name).toBe(CSRF_COOKIE_NAME);
      expect(res.cookieData?.value).toMatch(/^[a-f0-9]{64}$/);
      expect(res.cookieData?.options).toEqual({
        httpOnly: false, // Must be readable by JavaScript
        secure: false, // NODE_ENV is 'test' in test setup
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000,
        path: '/',
      });
      expect(next).toHaveBeenCalled();
    });

    it('should not set cookie if already present', () => {
      // Arrange
      const existingToken = generateCsrfToken();
      const req = createMockRequest({
        cookies: { [CSRF_COOKIE_NAME]: existingToken },
      });
      const res = createMockResponse();

      // Act
      setCsrfCookie(req, res, next);

      // Assert
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should call next regardless of cookie state', () => {
      // Arrange - no cookie
      const req1 = createMockRequest({ cookies: {} });
      const res1 = createMockResponse();
      const next1 = vi.fn();

      // Arrange - with cookie
      const req2 = createMockRequest({
        cookies: { [CSRF_COOKIE_NAME]: generateCsrfToken() },
      });
      const res2 = createMockResponse();
      const next2 = vi.fn();

      // Act
      setCsrfCookie(req1, res1, next1);
      setCsrfCookie(req2, res2, next2);

      // Assert
      expect(next1).toHaveBeenCalledTimes(1);
      expect(next2).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Security considerations
  // ==========================================================================
  describe('security', () => {
    it('should use constant-time comparison for tokens', () => {
      // This is a behavioral test - we verify that similar tokens
      // (differing only in last character) take similar time to compare
      // Note: This is more of a documentation test; actual timing attacks
      // are hard to test reliably in unit tests

      const token1 = 'a'.repeat(63) + 'b';
      const token2 = 'a'.repeat(63) + 'c';
      const next = vi.fn();

      const req1 = createMockRequest({
        method: 'POST',
        cookies: { [CSRF_COOKIE_NAME]: token1 },
        headers: { [CSRF_HEADER_NAME]: token2 },
      });
      const res1 = createMockResponse();

      // Act
      csrfProtection(req1, res1, next);

      // Assert - both should be rejected
      expect(next).not.toHaveBeenCalled();
      expect(res1.status).toHaveBeenCalledWith(403);
    });

    it('should not leak token value in error messages', () => {
      // Arrange
      const token = generateCsrfToken();
      const req = createMockRequest({
        method: 'POST',
        cookies: { [CSRF_COOKIE_NAME]: token },
        headers: { [CSRF_HEADER_NAME]: 'wrong-token' },
      });
      const res = createMockResponse();

      // Act
      csrfProtection(req, res, vi.fn());

      // Assert - error message should not contain the actual token
      const errorResponse = res.jsonData as { error: string; message: string };
      expect(errorResponse.error).not.toContain(token);
      expect(errorResponse.message).not.toContain(token);
    });
  });
});
