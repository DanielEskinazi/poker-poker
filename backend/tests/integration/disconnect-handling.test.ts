import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createSocketServer } from '../../src/websocket/socketServer.js';
import { sessionService } from '../../src/services/SessionService.js';
import { clearAllDisconnectTimers, setDisconnectGracePeriod } from '../../src/websocket/handlers/connectionHandlers.js';

/**
 * Integration Test: Participant Disconnect Handling
 *
 * Tests the WebSocket disconnect handler implementation including:
 * - Participant disconnect detection
 * - 30-second grace period before removal
 * - participant-left event broadcasting
 * - Moderator succession when moderator disconnects
 *
 * Success Criteria:
 * - When participant disconnects, other participants are notified after grace period
 * - Disconnected participant is removed from session after grace period
 * - If disconnected participant is last moderator, next participant is auto-promoted
 */

describe('Integration: Participant Disconnect Handling', () => {
  let httpServer: HTTPServer;
  let io: SocketIOServer;
  let client1: ClientSocket;
  let client2: ClientSocket;
  let client3: ClientSocket;
  const serverPort = 3001;
  const serverUrl = `http://localhost:${serverPort}`;

  beforeEach(async () => {
    // Clear any pending disconnect timers from previous tests
    clearAllDisconnectTimers();
    // Set a short grace period for faster tests (100ms)
    setDisconnectGracePeriod(100);

    // Create HTTP and Socket.io servers
    httpServer = createServer();
    io = createSocketServer(httpServer);

    // Start server
    await new Promise<void>((resolve) => {
      httpServer.listen(serverPort, resolve);
    });

    // Clear any existing sessions
    sessionService.clearAllSessions();
  });

  afterEach(async () => {
    // Clear disconnect timers before disconnecting sockets
    clearAllDisconnectTimers();

    // Disconnect all clients
    if (client1?.connected) client1.disconnect();
    if (client2?.connected) client2.disconnect();
    if (client3?.connected) client3.disconnect();

    // Clear timers again after disconnect
    clearAllDisconnectTimers();

    // Wait for disconnect events to process
    await new Promise(resolve => setTimeout(resolve, 150));

    // Close server
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    // Final cleanup
    clearAllDisconnectTimers();
    sessionService.clearAllSessions();
  });

  it('should broadcast participant-left event after disconnect', async () => {
    // Create a session
    const result = sessionService.createSession({ creatorName: 'Alice', browserFingerprint: 'fp_alice' });
    const sessionId = result.session.sessionId;

    // Connect first client (Alice - moderator)
    client1 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client1.once('connection-established', () => resolve());
    });

    // Join session as Alice
    client1.emit('join-session', {
      sessionId,
      name: 'Alice',
      browserFingerprint: 'fp_alice',
    });

    await new Promise<void>((resolve) => {
      client1.once('join-accepted', () => resolve());
    });

    // Connect second client (Bob)
    client2 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client2.once('connection-established', () => resolve());
    });

    // Join session as Bob
    client2.emit('join-session', {
      sessionId,
      name: 'Bob',
      browserFingerprint: 'fp_bob',
    });

    let bobParticipantId = '';
    await new Promise<void>((resolve) => {
      client2.once('join-accepted', (data) => {
        bobParticipantId = data.participant.participantId;
        resolve();
      });
    });

    // Listen for participant-left event on Alice's client
    const participantLeftPromise = new Promise<void>((resolve) => {
      client1.once('participant-left', (data) => {
        expect(data.participant.participantId).toBe(bobParticipantId);
        expect(data.participant.name).toBe('Bob');
        expect(data.reason).toBeDefined();
        resolve();
      });
    });

    // Disconnect Bob
    client2.disconnect();

    // Wait for participant-left event (with grace period consideration)
    // Note: In production, there's a 30-second grace period
    // For testing, we might want to make this configurable or mock timers
    await participantLeftPromise;
  });

  it('should remove participant from session after disconnect grace period', async () => {
    // Create a session
    const result = sessionService.createSession({ creatorName: 'Alice', browserFingerprint: 'fp_alice' });
    const sessionId = result.session.sessionId;

    // Connect and join first client (Alice)
    client1 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client1.once('connection-established', () => resolve());
    });

    client1.emit('join-session', {
      sessionId,
      name: 'Alice',
      browserFingerprint: 'fp_alice',
    });

    await new Promise<void>((resolve) => {
      client1.once('join-accepted', () => resolve());
    });

    // Connect and join second client (Bob)
    client2 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client2.once('connection-established', () => resolve());
    });

    client2.emit('join-session', {
      sessionId,
      name: 'Bob',
      browserFingerprint: 'fp_bob',
    });

    let bobParticipantId = '';
    await new Promise<void>((resolve) => {
      client2.once('join-accepted', (data) => {
        bobParticipantId = data.participant.participantId;
        resolve();
      });
    });

    // Verify Bob is in the session
    const sessionBefore = sessionService.getSession(sessionId);
    expect(sessionBefore?.participants.has(bobParticipantId)).toBe(true);

    // Disconnect Bob
    client2.disconnect();

    // Wait for grace period (100ms set in beforeEach) plus buffer
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify Bob has been removed from session
    const sessionAfter = sessionService.getSession(sessionId);
    expect(sessionAfter?.participants.has(bobParticipantId)).toBe(false);
  });

  it('should auto-promote next participant when last moderator disconnects', async () => {
    // Create a session
    const result = sessionService.createSession({ creatorName: 'Alice', browserFingerprint: 'fp_alice' });
    const sessionId = result.session.sessionId;

    // Connect first client (Alice - moderator)
    client1 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client1.once('connection-established', () => resolve());
    });

    client1.emit('join-session', {
      sessionId,
      name: 'Alice',
      browserFingerprint: 'fp_alice',
    });

    await new Promise<void>((resolve) => {
      client1.once('join-accepted', () => resolve());
    });

    // Connect second client (Bob)
    client2 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client2.once('connection-established', () => resolve());
    });

    client2.emit('join-session', {
      sessionId,
      name: 'Bob',
      browserFingerprint: 'fp_bob',
    });

    let bobParticipantId = '';
    await new Promise<void>((resolve) => {
      client2.once('join-accepted', (data) => {
        bobParticipantId = data.participant.participantId;
        resolve();
      });
    });

    // Verify Bob is NOT a moderator initially
    const sessionBefore = sessionService.getSession(sessionId);
    expect(sessionBefore?.moderatorIds.has(bobParticipantId)).toBe(false);

    // Listen for moderator-promoted event on Bob's client
    const moderatorPromotedPromise = new Promise<void>((resolve) => {
      client2.once('moderator-promoted', (data) => {
        expect(data.participantId).toBe(bobParticipantId);
        expect(data.promotionType).toBe('auto');
        resolve();
      });
    });

    // Disconnect Alice (the only moderator)
    client1.disconnect();

    // Wait for Bob to be promoted
    await moderatorPromotedPromise;

    // Verify Bob is now a moderator
    const sessionAfter = sessionService.getSession(sessionId);
    expect(sessionAfter?.moderatorIds.has(bobParticipantId)).toBe(true);
  });

  it('should handle reconnection within grace period', async () => {
    // Grace period is 100ms set in beforeEach
    // Create a session
    const result = sessionService.createSession({ creatorName: 'Alice', browserFingerprint: 'fp_alice' });
    const sessionId = result.session.sessionId;
    const aliceParticipantId = result.participant.participantId;

    // Connect and join first client (Alice)
    client1 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client1.once('connection-established', () => resolve());
    });

    client1.emit('join-session', {
      sessionId,
      name: 'Alice',
      browserFingerprint: 'fp_alice',
    });

    await new Promise<void>((resolve) => {
      client1.once('join-accepted', () => resolve());
    });

    // Disconnect Alice
    client1.disconnect();

    // Wait briefly but within grace period (100ms)
    await new Promise(resolve => setTimeout(resolve, 30));

    // Reconnect Alice with same fingerprint
    client1 = Client(serverUrl, { transports: ['websocket'] });
    await new Promise<void>((resolve) => {
      client1.once('connection-established', () => resolve());
    });

    client1.emit('join-session', {
      sessionId,
      name: 'Alice',
      browserFingerprint: 'fp_alice',
    });

    await new Promise<void>((resolve) => {
      client1.once('join-accepted', (data) => {
        // Should get the same participant ID
        expect(data.participant.participantId).toBe(aliceParticipantId);
        resolve();
      });
    });

    // Verify Alice is still in the session
    const sessionAfter = sessionService.getSession(sessionId);
    expect(sessionAfter?.participants.has(aliceParticipantId)).toBe(true);
  });
});
