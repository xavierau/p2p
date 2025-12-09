import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { Permission, hasAllPermissions } from '../constants/permissions';

export const authorize = (...requiredPermissions: Permission[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!user.role) {
      return res.status(403).json({ error: 'User role not found' });
    }

    if (!hasAllPermissions(user.role, requiredPermissions)) {
      return res.status(403).json({
        error: 'Forbidden: Insufficient permissions',
        required: requiredPermissions,
      });
    }

    next();
  };
};
