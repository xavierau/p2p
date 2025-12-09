import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ValidationError } from '../errors/AppError';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Global error handler middleware.
 * Must be registered AFTER all routes to catch errors.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const errorContext = {
    method: req.method,
    path: req.path,
    requestId: req.id,
    err: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    },
  };

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    logger.warn(errorContext, 'Validation error');
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Handle custom AppErrors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(errorContext, 'Application error');
    } else {
      logger.warn(errorContext, 'Application error');
    }

    const response: {
      error: string;
      code: string;
      details?: { field: string; message: string }[];
    } = {
      error: err.message,
      code: err.code,
    };
    if (err instanceof ValidationError && err.details.length > 0) {
      response.details = err.details;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn({ ...errorContext, prismaCode: err.code }, 'Prisma error');

    switch (err.code) {
      case 'P2002':
        res.status(409).json({
          error: 'Duplicate entry',
          code: 'DUPLICATE_ENTRY',
        });
        return;
      case 'P2025':
        res.status(404).json({
          error: 'Record not found',
          code: 'NOT_FOUND',
        });
        return;
      case 'P2003':
        res.status(400).json({
          error: 'Foreign key constraint failed',
          code: 'FK_CONSTRAINT',
        });
        return;
      default:
        res.status(500).json({
          error: 'Database error',
          code: 'DATABASE_ERROR',
        });
        return;
    }
  }

  // Unknown errors - hide details in production
  logger.error(errorContext, 'Unhandled error');
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: 'INTERNAL_ERROR',
  });
};
