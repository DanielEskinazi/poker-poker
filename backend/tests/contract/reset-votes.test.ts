/**
 * Contract Test: WebSocket reset-votes Event
 *
 * Tests the reset-votes event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful vote reset by moderator
 * 2. Broadcast votes-reset to all participants
 * 3. Clear vote state and return to voting phase
 * 4. Error when participant is not moderator
 * 5. Error when session not found
 * 6. Allow new voting round after reset
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Contract: reset-votes WebSocket Event', () => {
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
  });

  afterEach(async () => {
    if (moderatorSocket?.connected) moderatorSocket.disconnect();
    if (participant1Socket?.connected) participant1Socket.disconnect();
    if (participant2Socket?.connected) participant2Socket.disconnect();
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('Successful Reset Flow', () => {
    it('should reset votes and broadcast to all participants', async () => {
      // Cast votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 8
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Reveal votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Listen for votes-reset on all sockets
      const resetPromises = [
        new Promise<any>((resolve) => moderatorSocket.once('votes-reset', resolve)),
        new Promise<any>((resolve) => participant1Socket.once('votes-reset', resolve)),
        new Promise<any>((resolve) => participant2Socket.once('votes-reset', resolve))
      ];

      // Moderator resets votes
      moderatorSocket.emit('reset-votes', {
        sessionId,
        moderatorId
      });

      // Wait for all broadcasts
      const [modReset, p1Reset, p2Reset] = await Promise.all(resetPromises);

      // Verify all received the reset event
      for (const reset of [modReset, p1Reset, p2Reset]) {
        expect(reset).toMatchObject({
          timestamp: expect.any(Number)
        });
      }
    });

    it('should allow new voting round after reset', async () => {
      // First round - cast and reveal
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Reset
      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-reset', () => resolve());
        moderatorSocket.emit('reset-votes', {
          sessionId,
          moderatorId
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Second round - should be able to vote again
      const voteAcceptedPromise = new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
      });

      const voteCountPromise = new Promise<any>((resolve) => {
        participant1Socket.once('vote-count-updated', resolve);
      });

      moderatorSocket.emit('cast-vote', {
        sessionId,
        participantId: moderatorId,
        cardValue: 13 // Different vote
      });

      await voteAcceptedPromise;
      const voteCount = await voteCountPromise;

      expect(voteCount.votedCount).toBe(1);
      expect(voteCount.totalParticipants).toBe(3);
    });

    it('should clear vote state after reset', async () => {
      // Cast votes and reveal
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 8
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Reset
      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-reset', () => resolve());
        moderatorSocket.emit('reset-votes', {
          sessionId,
          moderatorId
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Cast a single vote to verify count starts from 0
      const voteCountPromise = new Promise<any>((resolve) => {
        participant2Socket.once('vote-count-updated', resolve);
      });

      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 3
        });
      });

      const voteCount = await voteCountPromise;

      // Should show 1 vote, not continuing from previous round
      expect(voteCount.votedCount).toBe(1);
      expect(voteCount.hasVoted[moderatorId]).toBe(true);
      expect(voteCount.hasVoted[participant1Id]).toBe(false);
      expect(voteCount.hasVoted[participant2Id]).toBe(false);
    });

    it('should allow reveal after reset and new votes', async () => {
      // First round
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Reset
      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-reset', () => resolve());
        moderatorSocket.emit('reset-votes', {
          sessionId,
          moderatorId
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Second round with different votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 13
        });
      });

      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 21
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Reveal second round
      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const revealed = await revealPromise;

      // Verify new votes are shown, not old ones
      expect(revealed.votes).toHaveLength(2);
      const voteValues = revealed.votes.map((v: any) => v.cardValue).sort();
      expect(voteValues).toEqual([13, 21]);
    });
  });

  describe('Error Handling', () => {
    it('should return NOT_MODERATOR error when non-moderator tries to reset', async () => {
      // Cast and reveal votes first
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Non-moderator tries to reset
      const errorPromise = new Promise<any>((resolve) => {
        participant1Socket.once('error', (data) => resolve(data));
      });

      participant1Socket.emit('reset-votes', {
        sessionId,
        moderatorId: participant1Id // Not a moderator
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'NOT_MODERATOR',
        message: expect.stringContaining('moderator')
      });
    });

    it('should return SESSION_NOT_FOUND error for invalid session', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('reset-votes', {
        sessionId: 'INVALID1',
        moderatorId
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

      moderatorSocket.emit('reset-votes', {
        moderatorId
        // Missing sessionId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      });
    });

    it('should return VALIDATION_ERROR for missing moderatorId', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('reset-votes', {
        sessionId
        // Missing moderatorId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.any(String)
      });
    });
  });

  describe('Complete Voting Cycle', () => {
    it('should support multiple consecutive voting rounds (vote→reveal→reset)', async () => {
      const rounds = 3;

      for (let round = 0; round < rounds; round++) {
        // Vote
        await new Promise<void>((resolve) => {
          moderatorSocket.once('vote-accepted', () => resolve());
          moderatorSocket.emit('cast-vote', {
            sessionId,
            participantId: moderatorId,
            cardValue: 5
          });
        });

        await new Promise<void>((resolve) => {
          participant1Socket.once('vote-accepted', () => resolve());
          participant1Socket.emit('cast-vote', {
            sessionId,
            participantId: participant1Id,
            cardValue: 8
          });
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Reveal
        await new Promise<void>((resolve) => {
          moderatorSocket.once('votes-revealed', () => resolve());
          moderatorSocket.emit('reveal-votes', {
            sessionId,
            moderatorId
          });
        });

        // Reset (except last round)
        if (round < rounds - 1) {
          await new Promise<void>((resolve) => {
            moderatorSocket.once('votes-reset', () => resolve());
            moderatorSocket.emit('reset-votes', {
              sessionId,
              moderatorId
            });
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Final assertion - just verify the cycle completed
      expect(true).toBe(true);
    });
  });
});
