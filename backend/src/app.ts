import express from 'express';
import cors from 'cors';
import { env } from './config/environment.js';
import logger from './utils/logger.js';
import sessionsRouter from './api/routes/sessions.js';
import exportRouter from './api/routes/export.js';

/**
 * Create and configure Express application
 */
export function createApp() {
  const app = express();

  // CORS configuration
  // In development, accept any localhost origin to support different ports
  const corsOrigin = env.NODE_ENV === 'development'
    ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) {
          callback(null, true);
          return;
        }
        // Allow any localhost origin in development
        if (origin.match(/^https?:\/\/localhost(:\d+)?$/)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : env.CORS_ORIGIN;

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    })
  );

  // JSON body parser
  app.use(express.json());

  // Request logging middleware
  app.use((req, _res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      ip: req.ip,
    });
    next();
  });

  // API Routes
  app.use('/api', sessionsRouter);
  app.use('/api', exportRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      uptime: process.uptime(),
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      logger.error('Express error handler', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message:
            env.NODE_ENV === 'production'
              ? 'Internal server error'
              : err.message,
        },
      });
    }
  );

  return app;
}

export default createApp();
