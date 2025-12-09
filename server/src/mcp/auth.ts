import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { UserRole } from '@prisma/client';

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

export async function verifyToken(token: string): Promise<VerifiedUser> {
  if (!token) {
    throw new AuthenticationError('Token required');
  }

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
