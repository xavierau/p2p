import { Request, Response, NextFunction } from 'express';

/**
 * Wraps async route handlers to catch errors and pass them to the error middleware.
 * Eliminates the need for try-catch blocks in route handlers.
 *
 * @example
 * router.get('/users', asyncHandler(async (req, res) => {
 *   const users = await userService.getUsers();
 *   res.json(users);
 * }));
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
