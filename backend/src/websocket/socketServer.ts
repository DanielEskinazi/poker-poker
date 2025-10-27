import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { config } from '../config/environment.js';
import { logWebSocketEvent, logError } from '../utils/logger.js';

/**
 * Create and configure Socket.io server
 */
export function createSocketServer(httpServer: HTTPServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
    // Connection configuration
    pingTimeout: 60000,
    pingInterval: 25000,
    // Transport options
    transports: ['websocket', 'polling'],
  });

  // Connection logging
  io.on('connection', (socket) => {
    logWebSocketEvent('client connected', socket.id, {
      transport: socket.conn.transport.name,
    });

    socket.on('disconnect', (reason) => {
      logWebSocketEvent('client disconnected', socket.id, { reason });
    });

    socket.on('error', (error) => {
      logError('Socket error', error, { socketId: socket.id });
    });
  });

  return io;
}
