/**
 * Integration Test: Complete Voting Flow
 *
 * Tests the end-to-end voting workflow across multiple components:
 * - Session creation
 * - Multiple participants joining
 * - Casting votes
 * - Vote counting (without revealing values)
 * - Vote changes before reveal
 * - Complete voting cycle
 *
 * This is an integration test that verifies multiple services and handlers
 * work together correctly, unlike contract tests which test individual events.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Integration: Complete Voting Flow', () => {
  let httpServer: Server;
  let ioServer: SocketIOServer;
  let serverUrl: string;
  let moderatorSocket: ClientSocket;
  let participant1Socket: ClientSocket;
  let participant2Socket: ClientSocket;
  let participant3Socket: ClientSocket;
  let sessionId: string;
  let moderatorId: string;
  let participant1Id: string;
  let participant2Id: string;
  let participant3Id: string;

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

    // Join with participant 3
    participant3Socket = ioClient(serverUrl, {
      query: { browserFingerprint: 'p3-fp' }
    });

    await new Promise<void>((resolve) => {
      participant3Socket.once('connection-established', () => resolve());
    });

    const join3Promise = new Promise<{ participant: { participantId: string } }>((resolve) => {
      participant3Socket.once('join-accepted', (data) => resolve(data));
    });

    participant3Socket.emit('join-session', {
      sessionId,
      name: 'Participant3',
      browserFingerprint: 'p3-fp'
    });

    const join3Data = await join3Promise;
    participant3Id = join3Data.participant.participantId;
  });

  afterEach(async () => {
    // Disconnect all sockets
    if (moderatorSocket?.connected) moderatorSocket.disconnect();
    if (participant1Socket?.connected) participant1Socket.disconnect();
    if (participant2Socket?.connected) participant2Socket.disconnect();
    if (participant3Socket?.connected) participant3Socket.disconnect();

    // Wait for disconnections to process
    await new Promise(resolve => setTimeout(resolve, 50));

    // Close server with force close of connections
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
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

  describe('Complete Voting Workflow', () => {
    it('should handle complete voting flow: vote → count → reveal → statistics', async () => {
      // Step 1: All participants cast votes
      const votePromises = [
        new Promise<void>((resolve) => {
          moderatorSocket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant1Socket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant2Socket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant3Socket.once('vote-accepted', () => resolve());
        })
      ];

      moderatorSocket.emit('cast-vote', {
        sessionId,
        participantId: moderatorId,
        cardValue: 5
      });

      participant1Socket.emit('cast-vote', {
        sessionId,
        participantId: participant1Id,
        cardValue: 8
      });

      participant2Socket.emit('cast-vote', {
        sessionId,
        participantId: participant2Id,
        cardValue: 5
      });

      participant3Socket.emit('cast-vote', {
        sessionId,
        participantId: participant3Id,
        cardValue: 13
      });

      await Promise.all(votePromises);

      // Wait for vote count updates to propagate
      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 2: Verify vote counts are broadcast correctly
      const voteCountPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('vote-count-updated', resolve);
      });

      // Trigger another vote count update by having someone change their vote
      participant1Socket.emit('cast-vote', {
        sessionId,
        participantId: participant1Id,
        cardValue: 8 // Same value, but triggers update
      });

      const voteCount = await voteCountPromise;

      expect(voteCount.votedCount).toBe(4);
      expect(voteCount.totalParticipants).toBe(4);
      expect(voteCount.hasVoted[moderatorId]).toBe(true);
      expect(voteCount.hasVoted[participant1Id]).toBe(true);
      expect(voteCount.hasVoted[participant2Id]).toBe(true);
      expect(voteCount.hasVoted[participant3Id]).toBe(true);

      // Verify vote values are NOT included in count update (privacy)
      expect(voteCount.votes).toBeUndefined();

      await new Promise(resolve => setTimeout(resolve, 100));

      // Step 3: Moderator reveals votes
      const revealPromises = [
        new Promise<any>((resolve) => moderatorSocket.once('votes-revealed', resolve)),
        new Promise<any>((resolve) => participant1Socket.once('votes-revealed', resolve)),
        new Promise<any>((resolve) => participant2Socket.once('votes-revealed', resolve)),
        new Promise<any>((resolve) => participant3Socket.once('votes-revealed', resolve))
      ];

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const [modRevealed, p1Revealed, p2Revealed, p3Revealed] = await Promise.all(revealPromises);

      // Step 4: Verify all participants received revealed votes
      for (const revealed of [modRevealed, p1Revealed, p2Revealed, p3Revealed]) {
        expect(revealed.votes).toHaveLength(4);
        expect(revealed.statistics).toBeDefined();
        expect(revealed.statistics.consensus).toBe(false); // Mixed votes
        expect(revealed.statistics.averageNumeric).toBeCloseTo(7.75, 1); // (5+8+5+13)/4
        expect(revealed.statistics.distribution).toEqual({ '5': 2, '8': 1, '13': 1 });
      }

      // Verify all vote values are present
      const voteValues = modRevealed.votes.map((v: any) => v.cardValue).sort((a: number, b: number) => a - b);
      expect(voteValues).toEqual([5, 5, 8, 13]);
    });

    it('should allow vote changes before reveal', async () => {
      // Participant 1 votes
      await new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', {
          sessionId,
          participantId: participant1Id,
          cardValue: 3
        });
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Participant 1 changes their vote
      const voteChangePromise = new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
      });

      const voteCountPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('vote-count-updated', resolve);
      });

      participant1Socket.emit('cast-vote', {
        sessionId,
        participantId: participant1Id,
        cardValue: 8 // Changed from 3 to 8
      });

      await voteChangePromise;
      const voteCount = await voteCountPromise;

      // Vote count should still be 1 (same participant)
      expect(voteCount.votedCount).toBe(1);
      expect(voteCount.hasVoted[participant1Id]).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Reveal and verify new value is used
      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', {
        sessionId,
        moderatorId
      });

      const revealed = await revealPromise;

      const p1Vote = revealed.votes.find((v: any) => v.participantId === participant1Id);
      expect(p1Vote.cardValue).toBe(8); // Changed value, not original 3
    });

    it('should prevent voting after reveal', async () => {
      // Cast and reveal votes
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

      await new Promise(resolve => setTimeout(resolve, 50));

      // Try to vote after reveal
      const errorPromise = new Promise<any>((resolve) => {
        participant1Socket.once('error', resolve);
      });

      participant1Socket.emit('cast-vote', {
        sessionId,
        participantId: participant1Id,
        cardValue: 8
      });

      const error = await errorPromise;

      expect(error.code).toBe('ALREADY_REVEALED');
    });

    it('should handle unanimous consensus correctly', async () => {
      // All participants vote the same
      const votePromises = [
        new Promise<void>((resolve) => {
          moderatorSocket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant1Socket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant2Socket.once('vote-accepted', () => resolve());
        }),
        new Promise<void>((resolve) => {
          participant3Socket.once('vote-accepted', () => resolve());
        })
      ];

      const sameValue = 8;
      moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: sameValue });
      participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: sameValue });
      participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: sameValue });
      participant3Socket.emit('cast-vote', { sessionId, participantId: participant3Id, cardValue: sameValue });

      await Promise.all(votePromises);
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reveal
      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });

      const revealed = await revealPromise;

      expect(revealed.statistics.consensus).toBe(true);
      expect(revealed.statistics.averageNumeric).toBe(sameValue);
      expect(revealed.statistics.distribution).toEqual({ '8': 4 });
    });
  });
});
