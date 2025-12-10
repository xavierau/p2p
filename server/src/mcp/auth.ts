import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { UserRole } from '@prisma/client';
import { isMcpToken, verifyMcpToken } from '../services/mcpTokenService';
import {
  McpTokenInvalidError,
  McpTokenExpiredError,
  McpTokenRevokedError,
} from '../domain/mcpToken/mcpTokenErrors';

interface JwtPayload {
  userId: number;
  iat?: number;
  exp?: number;
}

export interface VerifiedUser {
  userId: number;
  email: string;
  role: UserRole;
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Verifies a token and returns the associated user.
 * Supports both JWT tokens and MCP API tokens.
 *
 * MCP tokens start with 'mcp_' prefix and are long-lived tokens
 * designed for MCP clients like Claude Desktop.
 */
export async function verifyToken(token: string): Promise<VerifiedUser> {
  if (!token) {
    throw new AuthenticationError('Token required');
  }

  // Check if this is an MCP token (starts with 'mcp_')
  if (isMcpToken(token)) {
    try {
      return await verifyMcpToken(token);
    } catch (error) {
      if (error instanceof McpTokenInvalidError) {
        throw new AuthenticationError('Invalid MCP token');
      }
      if (error instanceof McpTokenExpiredError) {
        throw new AuthenticationError('MCP token expired');
      }
      if (error instanceof McpTokenRevokedError) {
        throw new AuthenticationError('MCP token has been revoked');
      }
      throw new AuthenticationError('MCP token verification failed');
    }
  }

  // Standard JWT verification
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET not configured');
  }

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    throw new AuthenticationError('Token verification failed');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}
