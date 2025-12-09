import { Request } from 'express';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  userId: number;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}
