/**
 * Integration Test: Reset Flow
 *
 * Tests the complete vote reset workflow across multiple scenarios:
 * - Complete cycle: vote → reveal → reset → new vote
 * - Broadcasting reset to all participants
 * - Clearing vote state and statistics
 * - Multiple consecutive voting rounds
 * - Moderator authorization
 * - State consistency across all participants
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Integration: Reset Flow', () => {
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

    // Setup session with moderator and 2 participants
    moderatorSocket = ioClient(serverUrl, { query: { browserFingerprint: 'mod-fp' } });
    await new Promise<void>((resolve) => moderatorSocket.once('connection-established', () => resolve()));

    const sessionData = await new Promise<any>((resolve) => {
      moderatorSocket.once('session-created', resolve);
      moderatorSocket.emit('create-session', { creatorName: 'Moderator', browserFingerprint: 'mod-fp' });
    });
    sessionId = sessionData.sessionId;
    moderatorId = sessionData.participant.participantId;

    // Participant 1
    participant1Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p1-fp' } });
    await new Promise<void>((resolve) => participant1Socket.once('connection-established', () => resolve()));
    const join1Data = await new Promise<any>((resolve) => {
      participant1Socket.once('join-accepted', resolve);
      participant1Socket.emit('join-session', { sessionId, name: 'Participant1', browserFingerprint: 'p1-fp' });
    });
    participant1Id = join1Data.participant.participantId;

    // Participant 2
    participant2Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p2-fp' } });
    await new Promise<void>((resolve) => participant2Socket.once('connection-established', () => resolve()));
    const join2Data = await new Promise<any>((resolve) => {
      participant2Socket.once('join-accepted', resolve);
      participant2Socket.emit('join-session', { sessionId, name: 'Participant2', browserFingerprint: 'p2-fp' });
    });
    participant2Id = join2Data.participant.participantId;
  });

  afterEach(async () => {
    if (moderatorSocket?.connected) moderatorSocket.disconnect();
    if (participant1Socket?.connected) participant1Socket.disconnect();
    if (participant2Socket?.connected) participant2Socket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 50));

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

  it('should handle complete voting cycle: vote → reveal → reset → new vote', async () => {
    // Round 1: Cast and reveal votes
    await Promise.all([
      new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
      }),
      new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 8 });
      }),
      new Promise<void>((resolve) => {
        participant2Socket.once('vote-accepted', () => resolve());
        participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 5 });
      })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Reveal round 1
    const reveal1Promise = new Promise<any>((resolve) => moderatorSocket.once('votes-revealed', resolve));
    moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    const revealed1 = await reveal1Promise;

    expect(revealed1.votes).toHaveLength(3);
    expect(revealed1.statistics.distribution).toEqual({ '5': 2, '8': 1 });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Reset votes - all participants should receive broadcast
    const resetPromises = [
      new Promise<any>((resolve) => moderatorSocket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant1Socket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant2Socket.once('votes-reset', resolve))
    ];

    moderatorSocket.emit('reset-votes', { sessionId, moderatorId });
    const [modReset, p1Reset, p2Reset] = await Promise.all(resetPromises);

    // Verify all received reset event
    for (const reset of [modReset, p1Reset, p2Reset]) {
      expect(reset.timestamp).toBeDefined();
    }

    await new Promise(resolve => setTimeout(resolve, 100));

    // Round 2: Cast new votes with different values
    await Promise.all([
      new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 13 });
      }),
      new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 21 });
      })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Reveal round 2
    const reveal2Promise = new Promise<any>((resolve) => moderatorSocket.once('votes-revealed', resolve));
    moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    const revealed2 = await reveal2Promise;

    // Verify only new votes are shown (2 votes: 13, 21)
    expect(revealed2.votes).toHaveLength(2);
    const voteValues = revealed2.votes.map((v: any) => v.cardValue).sort((a: number, b: number) => a - b);
    expect(voteValues).toEqual([13, 21]);
  });

  it('should broadcast reset to all participants simultaneously', async () => {
    // Cast and reveal
    await new Promise<void>((resolve) => {
      moderatorSocket.once('vote-accepted', () => resolve());
      moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await new Promise<void>((resolve) => {
      moderatorSocket.once('votes-revealed', () => resolve());
      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // All participants listen for reset
    const resetPromises = [
      new Promise<any>((resolve) => moderatorSocket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant1Socket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant2Socket.once('votes-reset', resolve))
    ];

    const resetTime = Date.now();
    moderatorSocket.emit('reset-votes', { sessionId, moderatorId });

    const [modReset, p1Reset, p2Reset] = await Promise.all(resetPromises);

    // All should receive within same time window (< 100ms difference)
    expect(modReset.timestamp).toBeGreaterThanOrEqual(resetTime);
    expect(p1Reset.timestamp).toBeGreaterThanOrEqual(resetTime);
    expect(p2Reset.timestamp).toBeGreaterThanOrEqual(resetTime);
  });

  it('should only allow moderator to reset votes', async () => {
    // Cast and reveal
    await new Promise<void>((resolve) => {
      moderatorSocket.once('vote-accepted', () => resolve());
      moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    await new Promise<void>((resolve) => {
      moderatorSocket.once('votes-revealed', () => resolve());
      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // Non-moderator tries to reset
    const errorPromise = new Promise<any>((resolve) => {
      participant1Socket.once('error', resolve);
    });

    participant1Socket.emit('reset-votes', { sessionId, moderatorId: participant1Id });

    const error = await errorPromise;
    expect(error.code).toBe('NOT_MODERATOR');
  });

  it('should support multiple consecutive voting rounds', async () => {
    const rounds = 3;
    const expectedDistributions = [
      { '5': 2, '8': 1 },      // Round 1
      { '3': 1, '13': 2 },     // Round 2
      { '1': 1, '2': 1, '3': 1 } // Round 3
    ];

    for (let round = 0; round < rounds; round++) {
      // Cast votes
      const votes = round === 0 ? [5, 8, 5] : round === 1 ? [13, 3, 13] : [1, 2, 3];

      await Promise.all([
        new Promise<void>((resolve) => {
          moderatorSocket.once('vote-accepted', () => resolve());
          moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: votes[0] });
        }),
        new Promise<void>((resolve) => {
          participant1Socket.once('vote-accepted', () => resolve());
          participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: votes[1] });
        }),
        new Promise<void>((resolve) => {
          participant2Socket.once('vote-accepted', () => resolve());
          participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: votes[2] });
        })
      ]);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Reveal
      const revealPromise = new Promise<any>((resolve) => {
        moderatorSocket.once('votes-revealed', resolve);
      });

      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
      const revealed = await revealPromise;

      expect(revealed.votes).toHaveLength(3);
      expect(revealed.statistics.distribution).toEqual(expectedDistributions[round]);

      // Reset (except last round)
      if (round < rounds - 1) {
        await new Promise<void>((resolve) => {
          moderatorSocket.once('votes-reset', () => resolve());
          moderatorSocket.emit('reset-votes', { sessionId, moderatorId });
        });

        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  });

  it('should clear vote state completely after reset', async () => {
    // Cast votes with specific values
    await Promise.all([
      new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
      }),
      new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 8 });
      }),
      new Promise<void>((resolve) => {
        participant2Socket.once('vote-accepted', () => resolve());
        participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 13 });
      })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Reveal
    await new Promise<void>((resolve) => {
      moderatorSocket.once('votes-revealed', () => resolve());
      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    });

    // Reset
    await new Promise<void>((resolve) => {
      moderatorSocket.once('votes-reset', () => resolve());
      moderatorSocket.emit('reset-votes', { sessionId, moderatorId });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Cast single vote to verify count
    const voteCountPromise = new Promise<any>((resolve) => {
      participant1Socket.once('vote-count-updated', resolve);
    });

    await new Promise<void>((resolve) => {
      moderatorSocket.once('vote-accepted', () => resolve());
      moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 3 });
    });

    const voteCount = await voteCountPromise;

    // Should show fresh state
    expect(voteCount.votedCount).toBe(1);
    expect(voteCount.hasVoted[moderatorId]).toBe(true);
    expect(voteCount.hasVoted[participant1Id]).toBe(false);
    expect(voteCount.hasVoted[participant2Id]).toBe(false);
  });

  it('should handle reset without all participants having voted', async () => {
    // Only some participants vote
    await Promise.all([
      new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
      }),
      new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 8 });
      })
      // participant2 does NOT vote
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Reveal partial votes
    await new Promise<void>((resolve) => {
      moderatorSocket.once('votes-revealed', () => resolve());
      moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
    });

    // Reset
    const resetPromises = [
      new Promise<any>((resolve) => moderatorSocket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant1Socket.once('votes-reset', resolve)),
      new Promise<any>((resolve) => participant2Socket.once('votes-reset', resolve))
    ];

    moderatorSocket.emit('reset-votes', { sessionId, moderatorId });
    await Promise.all(resetPromises);

    await new Promise(resolve => setTimeout(resolve, 100));

    // New round - all participants can vote
    const voteCountPromise = new Promise<any>((resolve) => {
      moderatorSocket.once('vote-count-updated', resolve);
    });

    await new Promise<void>((resolve) => {
      participant2Socket.once('vote-accepted', () => resolve());
      participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 13 });
    });

    const voteCount = await voteCountPromise;

    expect(voteCount.votedCount).toBe(1);
    expect(voteCount.hasVoted[participant2Id]).toBe(true);
  });
});
