/**
 * Test Server Helper
 *
 * Creates a test instance of the server for contract and integration testing
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import cors from 'cors';
import { registerSessionHandlers } from '../../src/websocket/handlers/sessionHandlers.js';
import { registerVotingHandlers } from '../../src/websocket/handlers/votingHandlers.js';
import { registerModeratorHandlers } from '../../src/websocket/handlers/moderatorHandlers.js';
import { registerConnectionHandlers } from '../../src/websocket/handlers/connectionHandlers.js';

export interface TestServer {
  httpServer: ReturnType<typeof createServer>;
  ioServer: SocketIOServer;
  serverUrl: string;
  port: number;
}

export async function createTestServer(): Promise<TestServer> {
  // Create Express app
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Create HTTP server
  const httpServer = createServer(app);

  // Create Socket.io server
  const ioServer = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Register WebSocket handlers
  ioServer.on('connection', (socket) => {
    // Emit connection-established event (matching main server behavior)
    socket.emit('connection-established', {
      socketId: socket.id,
      timestamp: Date.now()
    });

    registerSessionHandlers(socket);
    registerVotingHandlers(socket);
    registerModeratorHandlers(socket);
    registerConnectionHandlers(socket, ioServer);
  });

  // Find available port and start server
  const port = await new Promise<number>((resolve) => {
    httpServer.listen(0, () => {
      const address = httpServer.address();
      if (address && typeof address === 'object') {
        resolve(address.port);
      } else {
        resolve(3001); // fallback
      }
    });
  });

  const serverUrl = `http://localhost:${port}`;

  return {
    httpServer,
    ioServer,
    serverUrl,
    port
  };
}
