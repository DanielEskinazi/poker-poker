/**
 * Test Server Helper
 *
 * Creates a test instance of the server for contract and integration testing
 */
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
export interface TestServer {
    httpServer: ReturnType<typeof createServer>;
    ioServer: SocketIOServer;
    serverUrl: string;
    port: number;
}
export declare function createTestServer(): Promise<TestServer>;
//# sourceMappingURL=testServer.d.ts.map