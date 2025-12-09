import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import dotenv from 'dotenv';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';

// Load environment variables FIRST before any other imports that depend on them
dotenv.config();

import { validateJwtConfig } from './config/jwt';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter, authLimiter } from './middleware/rateLimiter';
import { metricsMiddleware } from './middleware/metrics';
import { setCsrfCookie, csrfProtection } from './middleware/csrf';
import { createMcpRouter } from './mcp/transports/http';
import logger from './utils/logger';

import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import authRoutes from './routes/auth';
import vendorRoutes from './routes/vendors';
import itemRoutes from './routes/items';
import invoiceRoutes from './routes/invoices';
import settingsRoutes from './routes/settings';
import departmentRoutes from './routes/departments';
import purchaseOrderRoutes from './routes/purchaseOrders';
import analyticsRoutes from './routes/analytics';

// Load subscribers for event-driven features
import './subscribers/accounting';
import './subscribers/cacheInvalidator';

// ============================================================================
// Critical Configuration Validation (MUST happen before server starts)
// ============================================================================
try {
  validateJwtConfig();
  logger.info('JWT configuration validated successfully');
} catch (error) {
  logger.fatal({ err: error }, 'Invalid JWT configuration - server cannot start');
  process.exit(1);
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Raw Prisma client for graceful shutdown
const prismaClient = new PrismaClient();

// ============================================================================
// Security Middleware
// ============================================================================

// Helmet.js for security headers (must be first)
app.use(helmet());

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        logger.warn({ origin, allowedOrigins }, 'CORS blocked request from origin');
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

// ============================================================================
// Request Parsing & Logging
// ============================================================================

app.use(express.json());
app.use(cookieParser());

// Set CSRF cookie on all responses (enables CSRF protection on frontend)
app.use(setCsrfCookie);

// CSRF protection for API routes (state-changing requests)
// Skip certain paths that don't need CSRF (login, register use cookies, refresh uses httpOnly cookie)
app.use('/api', (req, res, next) => {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  // Skip CSRF for auth endpoints that use httpOnly cookies
  if (
    req.path.startsWith('/auth/login') ||
    req.path.startsWith('/auth/register') ||
    req.path.startsWith('/auth/refresh') ||
    req.path.startsWith('/auth/csrf')
  ) {
    return next();
  }
  // Apply CSRF protection to other state-changing requests
  return csrfProtection(req, res, next);
});

// Request logging with Pino
app.use(
  pinoHttp({
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health', // Don't log health checks
    },
    customLogLevel: (_req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} completed with ${res.statusCode}`;
    },
    customErrorMessage: (req, _res, err) => {
      return `${req.method} ${req.url} failed: ${err.message}`;
    },
  })
);

// ============================================================================
// Health Check & Metrics (before rate limiting)
// ============================================================================

app.use('/health', healthRoutes);
app.use('/metrics', metricsRoutes);

// ============================================================================
// Rate Limiting
// ============================================================================

app.use('/api', apiLimiter);

// ============================================================================
// Metrics Middleware (after health/metrics, before API routes)
// ============================================================================

app.use(metricsMiddleware);

// ============================================================================
// Routes
// ============================================================================

app.get('/', (_req, res) => {
  res.send('Payment Management API');
});

// Apply stricter rate limiting to auth routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/analytics', analyticsRoutes);

// MCP HTTP transport
app.use('/api', createMcpRouter());

// ============================================================================
// Error Handling
// ============================================================================

app.use(errorHandler);

// ============================================================================
// Server Startup & Graceful Shutdown
// ============================================================================

let server: Server;

const startServer = (): void => {
  server = app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server started');
    logger.info({ endpoint: `http://localhost:${PORT}/api/mcp` }, 'MCP HTTP endpoint available');
    logger.info({ endpoint: `http://localhost:${PORT}/health` }, 'Health check endpoint available');
  });
};

/**
 * Graceful shutdown handler.
 * Ensures all connections are properly closed before process exit.
 */
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  // Stop accepting new connections
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          logger.error({ err }, 'Error closing HTTP server');
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });
    });
  }

  // Disconnect Prisma client
  try {
    await prismaClient.$disconnect();
    logger.info('Prisma client disconnected');
  } catch (error) {
    logger.error({ err: error }, 'Error disconnecting Prisma client');
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.fatal({ reason, promise }, 'Unhandled rejection');
});

startServer();
