import { createServer } from 'http';
import { createApp } from './app.js';
import { createSocketServer } from './websocket/socketServer.js';
import { env } from './config/environment.js';
import logger from './utils/logger.js';
import { CleanupService } from './services/CleanupService.js';
import { sessionService } from './services/SessionService.js';

/**
 * Start the HTTP and WebSocket servers
 */
async function startServer() {
  try {
    // Create Express app
    const app = createApp();

    // Create HTTP server
    const httpServer = createServer(app);

    // Create Socket.io server
    const io = createSocketServer(httpServer);

    // Create and start cleanup service
    const cleanupService = new CleanupService(io, sessionService);
    cleanupService.start();

    // Start listening
    httpServer.listen(env.PORT, env.HOST, () => {
      logger.info(`Server listening on http://${env.HOST}:${env.PORT}`, {
        nodeEnv: env.NODE_ENV,
        corsOrigin: env.CORS_ORIGIN,
      });
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      cleanupService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      cleanupService.stop();
      httpServer.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    // Export io instance for use in handlers
    return { app, httpServer, io };
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((error) => {
    logger.error('Unhandled error during server startup', error as Error);
    process.exit(1);
  });
}

export { startServer };
