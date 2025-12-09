import pino from 'pino';

/**
 * Structured logger using Pino.
 * Provides consistent logging across the application with proper log levels
 * and contextual information.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    env: process.env.NODE_ENV || 'development',
  },
});

/**
 * Creates a child logger with additional context.
 * Useful for adding request-specific information.
 */
export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};

export default logger;
