import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps async route handlers to automatically catch and forward errors
 * to the error handling middleware.
 *
 * Usage:
 * ```typescript
 * router.get('/items', asyncHandler(async (req, res) => {
 *   const items = await getItems();
 *   res.json(items);
 * }));
 * ```
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
