/**
 * Contract Test: WebSocket promote-moderator Event
 *
 * Tests the promote-moderator event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful moderator promotion by existing moderator
 * 2. Broadcast moderator-promoted to all participants
 * 3. Promoted participant gains moderator privileges
 * 4. Multiple simultaneous moderators supported
 * 5. Error when promoter is not moderator
 * 6. Error when target participant not found
 * 7. Error when target is already moderator
 * 8. Error when session not found
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Contract: promote-moderator WebSocket Event', () => {
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let serverUrl: string;
  let moderatorSocket: ClientSocket;
  let participant1Socket: ClientSocket;
  let participant2Socket: ClientSocket;
  let sessionId: string;
  let moderatorId: string;
  let participant1Id: string;
  let participant2Id: string;

  beforeEach(async () => {
    const testServer = await createTestServer();
    httpServer = testServer.httpServer;
    ioServer = testServer.ioServer;
    serverUrl = testServer.serverUrl;

    // Create a session with moderator
    moderatorSocket = ioClient(serverUrl, {
      query: { browserFingerprint: 'mod-fp' }
    });

    await new Promise<void>((resolve) => {
      moderatorSocket.once('connection-established', () => resolve());
    });

    const createSessionPromise = new Promise<{ sessionId: string; participant: { participantId: string } }>((resolve) => {
      moderatorSocket.once('session-created', (data) => resolve(data));
    });

    moderatorSocket.emit('create-session', {
      creatorName: 'Moderator',
      browserFingerprint: 'mod-fp'
    });

    const sessionData = await createSessionPromise;
    sessionId = sessionData.sessionId;
    moderatorId = sessionData.participant.participantId;

    // Join with participant 1
    participant1Socket = ioClient(serverUrl, {
      query: { browserFingerprint: 'p1-fp' }
    });

    await new Promise<void>((resolve) => {
      participant1Socket.once('connection-established', () => resolve());
    });

    const join1Promise = new Promise<{ participant: { participantId: string } }>((resolve) => {
      participant1Socket.once('join-accepted', (data) => resolve(data));
    });

    participant1Socket.emit('join-session', {
      sessionId,
      name: 'Participant1',
      browserFingerprint: 'p1-fp'
    });

    const join1Data = await join1Promise;
    participant1Id = join1Data.participant.participantId;

    // Join with participant 2
    participant2Socket = ioClient(serverUrl, {
      query: { browserFingerprint: 'p2-fp' }
    });

    await new Promise<void>((resolve) => {
      participant2Socket.once('connection-established', () => resolve());
    });

    const join2Promise = new Promise<{ participant: { participantId: string } }>((resolve) => {
      participant2Socket.once('join-accepted', (data) => resolve(data));
    });

    participant2Socket.emit('join-session', {
      sessionId,
      name: 'Participant2',
      browserFingerprint: 'p2-fp'
    });

    const join2Data = await join2Promise;
    participant2Id = join2Data.participant.participantId;

    // Wait for all joins to complete
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    // Disconnect all sockets
    if (moderatorSocket?.connected) moderatorSocket.disconnect();
    if (participant1Socket?.connected) participant1Socket.disconnect();
    if (participant2Socket?.connected) participant2Socket.disconnect();

    // Wait a bit for disconnections to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Close server with force close of connections
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          // Force close if it takes too long
          httpServer.closeAllConnections?.();
          resolve();
        }, 1000);

        httpServer.close((err) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve();
        });
      });
    }
  });

  describe('Successful Promotion Flow', () => {
    it('should promote participant when existing moderator requests and broadcast to all', async () => {
      // Listen for moderator-promoted on all sockets
      const promotionPromises = [
        new Promise<any>((resolve) => moderatorSocket.once('moderator-promoted', resolve)),
        new Promise<any>((resolve) => participant1Socket.once('moderator-promoted', resolve)),
        new Promise<any>((resolve) => participant2Socket.once('moderator-promoted', resolve))
      ];

      // Moderator promotes participant1
      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId,
        targetParticipantId: participant1Id
      });

      // Wait for all broadcasts
      const [modPromotion, p1Promotion, p2Promotion] = await Promise.all(promotionPromises);

      // Verify all received the same data structure
      for (const promotion of [modPromotion, p1Promotion, p2Promotion]) {
        expect(promotion).toMatchObject({
          participantId: participant1Id,
          participantName: 'Participant1',
          participantEmoji: expect.any(String),
          promotionType: 'manual',
          timestamp: expect.any(Number)
        });
      }
    });

    it('should allow newly promoted moderator to use moderator privileges', async () => {
      // Promote participant1
      await new Promise<void>((resolve) => {
        moderatorSocket.once('moderator-promoted', () => resolve());
        moderatorSocket.emit('promote-moderator', {
          sessionId,
          promoterId: moderatorId,
          targetParticipantId: participant1Id
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Now participant1 should be able to promote participant2
      const promotionPromise = new Promise<any>((resolve) => {
        participant1Socket.once('moderator-promoted', resolve);
      });

      participant1Socket.emit('promote-moderator', {
        sessionId,
        promoterId: participant1Id, // Now a moderator
        targetParticipantId: participant2Id
      });

      const promotion = await promotionPromise;

      expect(promotion).toMatchObject({
        participantId: participant2Id,
        participantName: 'Participant2',
        promotionType: 'manual'
      });
    });

    it('should support multiple simultaneous moderators', async () => {
      // Promote participant1
      await new Promise<void>((resolve) => {
        moderatorSocket.once('moderator-promoted', () => resolve());
        moderatorSocket.emit('promote-moderator', {
          sessionId,
          promoterId: moderatorId,
          targetParticipantId: participant1Id
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Promote participant2
      await new Promise<void>((resolve) => {
        moderatorSocket.once('moderator-promoted', () => resolve());
        moderatorSocket.emit('promote-moderator', {
          sessionId,
          promoterId: moderatorId,
          targetParticipantId: participant2Id
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Both should now be able to perform moderator actions
      // Test that participant1 can reveal votes (moderator action)
      // First cast a vote
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      // Participant1 (now moderator) reveals votes
      const revealPromise = new Promise<void>((resolve) => {
        participant1Socket.once('votes-revealed', () => resolve());
      });

      participant1Socket.emit('reveal-votes', {
        sessionId,
        moderatorId: participant1Id
      });

      await revealPromise;

      // Test that participant2 can reset votes (moderator action)
      const resetPromise = new Promise<void>((resolve) => {
        participant2Socket.once('votes-reset', () => resolve());
      });

      participant2Socket.emit('reset-votes', {
        sessionId,
        moderatorId: participant2Id
      });

      await resetPromise;

      // If we get here, both moderator actions succeeded
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return NOT_MODERATOR error when non-moderator tries to promote', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        participant1Socket.once('error', (data) => resolve(data));
      });

      // Non-moderator tries to promote
      participant1Socket.emit('promote-moderator', {
        sessionId,
        promoterId: participant1Id, // Not a moderator
        targetParticipantId: participant2Id
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'NOT_MODERATOR',
        message: expect.stringContaining('moderator')
      });
    });

    it('should return PARTICIPANT_NOT_FOUND error for invalid target participant', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId,
        targetParticipantId: 'invalid_participant_id'
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'PARTICIPANT_NOT_FOUND',
        message: expect.any(String)
      });
    });

    it('should return ALREADY_MODERATOR error when promoting existing moderator', async () => {
      // Promote participant1 first
      await new Promise<void>((resolve) => {
        moderatorSocket.once('moderator-promoted', () => resolve());
        moderatorSocket.emit('promote-moderator', {
          sessionId,
          promoterId: moderatorId,
          targetParticipantId: participant1Id
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to promote participant1 again
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId,
        targetParticipantId: participant1Id // Already a moderator
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'ALREADY_MODERATOR',
        message: expect.stringContaining('already')
      });
    });

    it('should return SESSION_NOT_FOUND error for invalid session', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId: 'INVALID1',
        promoterId: moderatorId,
        targetParticipantId: participant1Id
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'SESSION_NOT_FOUND',
        message: expect.any(String)
      });
    });

    it('should return VALIDATION_ERROR for missing sessionId', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        promoterId: moderatorId,
        targetParticipantId: participant1Id
        // Missing sessionId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      });
    });

    it('should return VALIDATION_ERROR for missing promoterId', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId,
        targetParticipantId: participant1Id
        // Missing promoterId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      });
    });

    it('should return VALIDATION_ERROR for missing targetParticipantId', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId
        // Missing targetParticipantId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      });
    });
  });

  describe('Promotion Type', () => {
    it('should set promotionType to "manual" for manual promotions', async () => {
      const promotionPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('moderator-promoted', resolve);
      });

      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId,
        targetParticipantId: participant1Id
      });

      const promotion = await promotionPromise;

      expect(promotion.promotionType).toBe('manual');
    });
  });
});
