import express from 'express';
import cors from 'cors';
import { config } from './config/environment.js';
import logger from './utils/logger.js';

/**
 * Create and configure Express application
 */
export function createApp() {
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: config.corsOrigin,
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
            config.nodeEnv === 'production'
              ? 'Internal server error'
              : err.message,
        },
      });
    }
  );

  return app;
}

export default createApp();
