/**
 * Contract Test: WebSocket reveal-votes Event
 *
 * Tests the reveal-votes event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful vote reveal with valid moderator
 * 2. Broadcast votes-revealed to all participants with vote values and statistics
 * 3. Statistics calculation (consensus, average, distribution)
 * 4. Error when participant is not moderator
 * 5. Error when no votes exist
 * 6. Error when votes already revealed
 * 7. Error when session not found
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Contract: reveal-votes WebSocket Event', () => {
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

  describe('Successful Reveal Flow', () => {
    it('should reveal votes when moderator requests and broadcast to all participants', async () => {
      // Cast votes from all participants
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

      await new Promise<void>((resolve) => {
        participant2Socket.once('vote-accepted', () => resolve());
        participant2Socket.emit('cast-vote', {
          sessionId,
          participantId: participant2Id,
          cardValue: 5
        });
      });

      // Wait for vote count updates to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Listen for votes-revealed on all sockets
      const revealPromises = [
        new Promise<any>((resolve) => moderatorSocket.once('votes-revealed', resolve)),
        new Promise<any>((resolve) => participant1Socket.once('votes-revealed', resolve)),
        new Promise<any>((resolve) => participant2Socket.once('votes-revealed', resolve))
      ];

      // Moderator reveals votes
      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      // Wait for all broadcasts
      const [modRevealed, p1Revealed, p2Revealed] = await Promise.all(revealPromises);

      // Verify all received the same data structure
      for (const revealed of [modRevealed, p1Revealed, p2Revealed]) {
        expect(revealed).toMatchObject({
          votes: expect.arrayContaining([
            expect.objectContaining({
              participantId: expect.any(String),
              participantName: expect.any(String),
              participantEmoji: expect.any(String),
              cardValue: expect.any(Number)
            })
          ]),
          statistics: expect.objectContaining({
            consensus: expect.any(Boolean),
            averageNumeric: expect.any(Number),
            distribution: expect.any(Object)
          }),
          timestamp: expect.any(Number)
        });

        // Verify we have 3 votes
        expect(revealed.votes).toHaveLength(3);
      }

      // Verify vote values are correct
      const votes = modRevealed.votes;
      const voteValues = votes.map((v: any) => v.cardValue).sort();
      expect(voteValues).toEqual([5, 5, 8]);
    });

    it('should calculate statistics correctly - consensus when all votes match', async () => {
      // All participants vote the same
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 8
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

      await new Promise<void>((resolve) => {
        participant2Socket.once('vote-accepted', () => resolve());
        participant2Socket.emit('cast-vote', {
          sessionId,
          participantId: participant2Id,
          cardValue: 8
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const revealed = await revealPromise;

      // Verify consensus
      expect(revealed.statistics.consensus).toBe(true);
      expect(revealed.statistics.averageNumeric).toBe(8);
      expect(revealed.statistics.distribution).toEqual({ '8': 3 });
    });

    it('should calculate statistics correctly - no consensus with mixed votes', async () => {
      // Different votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 1
        });
      });

      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 13
        });
      });

      await new Promise<void>((resolve) => {
        participant2Socket.once('vote-accepted', () => resolve());
        participant2Socket.emit('cast-vote', {
          sessionId,
          participantId: participant2Id,
          cardValue: 8
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const revealed = await revealPromise;

      // Verify no consensus
      expect(revealed.statistics.consensus).toBe(false);
      expect(revealed.statistics.averageNumeric).toBeCloseTo(7.33, 1); // (1+13+8)/3
      expect(revealed.statistics.distribution).toEqual({ '1': 1, '8': 1, '13': 1 });
    });

    it('should handle "?" votes in statistics', async () => {
      // One participant votes "?"
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
          cardValue: '?'
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const revealed = await revealPromise;

      // Verify "?" is in distribution
      expect(revealed.statistics.distribution).toHaveProperty('?');
      // Average should only include numeric votes
      expect(revealed.statistics.averageNumeric).toBe(5); // Only counting the 5
    });
  });

  describe('Error Handling', () => {
    it('should return NOT_MODERATOR error when non-moderator tries to reveal', async () => {
      // Cast some votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Non-moderator tries to reveal
      const errorPromise = new Promise<any>((resolve) => {
        participant1Socket.once('error', (data) => resolve(data));
      });

      participant1Socket.emit('reveal-votes', {
        sessionId,
        moderatorId: participant1Id // Not a moderator
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'NOT_MODERATOR',
        message: expect.stringContaining('moderator')
      });
    });

    it('should return NO_VOTES error when revealing with no votes cast', async () => {
      // Try to reveal without any votes
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'NO_VOTES',
        message: expect.any(String)
      });
    });

    it('should return ALREADY_REVEALED error when revealing twice', async () => {
      // Cast a vote
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Reveal once
      await new Promise<void>((resolve) => {
        moderatorSocket.once('votes-revealed', () => resolve());
        moderatorSocket.emit('reveal-votes', {
          sessionId,
          moderatorId
        });
      });

      // Try to reveal again
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const error = await errorPromise;

      expect(error).toMatchObject({
        code: 'ALREADY_REVEALED',
        message: expect.stringContaining('already')
      });
    });

    it('should return SESSION_NOT_FOUND error for invalid session', async () => {
      const errorPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('error', (data) => resolve(data));
      });

      moderatorSocket.emit('reveal-votes', {
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

      moderatorSocket.emit('reveal-votes', {
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

      moderatorSocket.emit('reveal-votes', {
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

  describe('Vote Privacy', () => {
    it('should NOT reveal vote values before reveal-votes is called', async () => {
      // Cast votes
      await new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', {
          sessionId,
          participantId: moderatorId,
          cardValue: 5
        });
      });

      // Listen for vote-count-updated
      const voteCountPromise = new Promise<any>((resolve) => {
        participant1Socket.once('vote-count-updated', (data) => resolve(data));
      });

      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 8
        });
      });

      const voteCount = await voteCountPromise;

      // Ensure vote values are NOT exposed before reveal
      expect(voteCount.votes).toBeUndefined();
      expect(voteCount).not.toHaveProperty('votes');
      expect(voteCount).not.toHaveProperty('statistics');

      // Only counts should be present
      expect(voteCount).toHaveProperty('votedCount');
      expect(voteCount).toHaveProperty('totalParticipants');
      expect(voteCount).toHaveProperty('hasVoted');
    });
  });
});
