import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { env } from '../config/environment.js';
import { logWebSocketEvent, logError } from '../utils/logger.js';
import { registerSessionHandlers } from './handlers/sessionHandlers.js';

/**
 * Create and configure Socket.io server
 */
export function createSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      credentials: true,
    },
    // Connection configuration
    pingTimeout: 60000,
    pingInterval: 25000,
    // Transport options
    transports: ['websocket', 'polling'],
  });

  // Connection logging and event handler registration
  io.on('connection', (socket) => {
    logWebSocketEvent('client connected', socket.id, {
      transport: socket.conn.transport.name,
    });

    // Emit connection-established event
    socket.emit('connection-established', {
      socketId: socket.id,
      timestamp: Date.now()
    });

    // Register session event handlers
    registerSessionHandlers(socket);

    // TODO: Register other event handlers in future phases
    // - registerVotingHandlers(socket) - Phase 5
    // - registerModeratorHandlers(socket) - Phase 9

    socket.on('disconnect', (reason) => {
      logWebSocketEvent('client disconnected', socket.id, { reason });
      // TODO: Handle participant disconnect in Phase 6 (User Story 6)
    });

    socket.on('error', (error) => {
      logError('Socket error', error, { socketId: socket.id });
    });
  });

  return io;
}
