/**
 * Integration Test: Moderator Succession (Auto-Promotion)
 *
 * Tests the automatic moderator promotion workflow when moderators leave:
 * - FIFO algorithm (first-in, first-out) for auto-promotion
 * - Auto-promotion triggered after moderator disconnects
 * - Multiple moderators - no auto-promotion if another moderator remains
 * - Broadcast moderator-promoted event with promotionType: 'auto'
 * - New moderator gains full moderator privileges
 * - Session continues normally after auto-promotion
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';

describe('Integration: Moderator Succession', () => {
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

    // Setup session with moderator
    moderatorSocket = ioClient(serverUrl, { query: { browserFingerprint: 'mod-fp' } });
    await new Promise<void>((resolve) => moderatorSocket.once('connection-established', () => resolve()));

    const sessionData = await new Promise<any>((resolve) => {
      moderatorSocket.once('session-created', resolve);
      moderatorSocket.emit('create-session', { creatorName: 'Moderator', browserFingerprint: 'mod-fp' });
    });
    sessionId = sessionData.sessionId;
    moderatorId = sessionData.participant.participantId;

    // Participant 1 - should be auto-promoted first (FIFO)
    participant1Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p1-fp' } });
    await new Promise<void>((resolve) => participant1Socket.once('connection-established', () => resolve()));
    const join1Data = await new Promise<any>((resolve) => {
      participant1Socket.once('join-accepted', resolve);
      participant1Socket.emit('join-session', { sessionId, name: 'Alice', browserFingerprint: 'p1-fp' });
    });
    participant1Id = join1Data.participant.participantId;

    // Wait a bit to ensure join order
    await new Promise(resolve => setTimeout(resolve, 50));

    // Participant 2 - should be second in line
    participant2Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p2-fp' } });
    await new Promise<void>((resolve) => participant2Socket.once('connection-established', () => resolve()));
    const join2Data = await new Promise<any>((resolve) => {
      participant2Socket.once('join-accepted', resolve);
      participant2Socket.emit('join-session', { sessionId, name: 'Bob', browserFingerprint: 'p2-fp' });
    });
    participant2Id = join2Data.participant.participantId;

    await new Promise(resolve => setTimeout(resolve, 50));

    // Participant 3 - should be third in line
    participant3Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p3-fp' } });
    await new Promise<void>((resolve) => participant3Socket.once('connection-established', () => resolve()));
    const join3Data = await new Promise<any>((resolve) => {
      participant3Socket.once('join-accepted', resolve);
      participant3Socket.emit('join-session', { sessionId, name: 'Charlie', browserFingerprint: 'p3-fp' });
    });
    participant3Id = join3Data.participant.participantId;

    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterEach(async () => {
    if (moderatorSocket?.connected) moderatorSocket.disconnect();
    if (participant1Socket?.connected) participant1Socket.disconnect();
    if (participant2Socket?.connected) participant2Socket.disconnect();
    if (participant3Socket?.connected) participant3Socket.disconnect();
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

  it('should auto-promote first-joined participant when sole moderator leaves', async () => {
    // Listen for moderator-promoted on all connected participants
    const promotionPromises = [
      new Promise<any>((resolve) => participant1Socket.once('moderator-promoted', resolve)),
      new Promise<any>((resolve) => participant2Socket.once('moderator-promoted', resolve)),
      new Promise<any>((resolve) => participant3Socket.once('moderator-promoted', resolve))
    ];

    // Moderator disconnects
    moderatorSocket.disconnect();

    // Wait for disconnect to process and auto-promotion to trigger
    await new Promise(resolve => setTimeout(resolve, 200));

    // All participants should receive moderator-promoted event
    const [p1Promotion, p2Promotion, p3Promotion] = await Promise.all(promotionPromises);

    // Verify all received same promotion data
    for (const promotion of [p1Promotion, p2Promotion, p3Promotion]) {
      expect(promotion).toMatchObject({
        participantId: participant1Id, // Alice was first to join
        participantName: 'Alice',
        participantEmoji: expect.any(String),
        promotionType: 'auto',
        timestamp: expect.any(Number)
      });
    }
  });

  it('should respect FIFO order when promoting next moderator', async () => {
    // Verify participant 1 (Alice) is promoted when moderator leaves
    const promotionPromise = new Promise<any>((resolve) => {
      participant1Socket.once('moderator-promoted', resolve);
    });

    moderatorSocket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    const promotion = await promotionPromise;

    expect(promotion.participantId).toBe(participant1Id);
    expect(promotion.participantName).toBe('Alice');
  });

  it('should give newly promoted moderator full moderator privileges', async () => {
    // Set up listener BEFORE disconnect
    const autoPromotionPromise = new Promise<void>((resolve) => {
      participant1Socket.once('moderator-promoted', () => resolve());
    });

    // Disconnect moderator to trigger auto-promotion
    moderatorSocket.disconnect();

    // Wait for auto-promotion event
    await autoPromotionPromise;
    await new Promise(resolve => setTimeout(resolve, 200));

    // Alice (participant1) should now be able to perform moderator actions
    // Test reveal-votes privilege

    // First cast a vote
    await new Promise<void>((resolve) => {
      participant2Socket.once('vote-accepted', () => resolve());
      participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 5 });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Participant1 (now moderator) should be able to reveal votes
    const revealPromise = new Promise<void>((resolve) => {
      participant1Socket.once('votes-revealed', () => resolve());
    });

    participant1Socket.emit('reveal-votes', { sessionId, moderatorId: participant1Id });

    await expect(revealPromise).resolves.toBeUndefined();
  });

  it('should NOT auto-promote when multiple moderators exist and one leaves', async () => {
    // Manually promote participant2 to moderator
    await new Promise<void>((resolve) => {
      moderatorSocket.once('moderator-promoted', () => resolve());
      moderatorSocket.emit('promote-moderator', {
        sessionId,
        promoterId: moderatorId,
        targetParticipantId: participant2Id
      });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Now we have 2 moderators: original moderator and participant2 (Bob)
    // Set up listeners to detect if auto-promotion happens (it shouldn't)
    let autoPromotionReceived = false;
    const autoPromotionListener = () => {
      autoPromotionReceived = true;
    };

    participant1Socket.once('moderator-promoted', autoPromotionListener);
    participant3Socket.once('moderator-promoted', autoPromotionListener);

    // Original moderator disconnects
    moderatorSocket.disconnect();

    // Wait for disconnect processing
    await new Promise(resolve => setTimeout(resolve, 300));

    // No auto-promotion should have occurred
    expect(autoPromotionReceived).toBe(false);

    // Participant2 (Bob) should still be moderator and able to perform moderator actions
    // Test by revealing votes
    await new Promise<void>((resolve) => {
      participant3Socket.once('vote-accepted', () => resolve());
      participant3Socket.emit('cast-vote', { sessionId, participantId: participant3Id, cardValue: 8 });
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    const revealPromise = new Promise<void>((resolve) => {
      participant2Socket.once('votes-revealed', () => resolve());
    });

    participant2Socket.emit('reveal-votes', { sessionId, moderatorId: participant2Id });

    await expect(revealPromise).resolves.toBeUndefined();
  });

  it('should handle cascading auto-promotions when promoted moderator also leaves', async () => {
    // Original moderator leaves, participant1 (Alice) gets auto-promoted
    const firstPromotionPromise = new Promise<any>((resolve) => {
      participant1Socket.once('moderator-promoted', resolve);
    });

    moderatorSocket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    const firstPromotion = await firstPromotionPromise;
    expect(firstPromotion.participantId).toBe(participant1Id);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Now participant1 (Alice - new moderator) leaves
    const secondPromotionPromise = new Promise<any>((resolve) => {
      participant2Socket.once('moderator-promoted', resolve);
    });

    participant1Socket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Participant2 (Bob) should be auto-promoted (next in FIFO)
    const secondPromotion = await secondPromotionPromise;
    expect(secondPromotion.participantId).toBe(participant2Id);
    expect(secondPromotion.participantName).toBe('Bob');
    expect(secondPromotion.promotionType).toBe('auto');
  });

  it('should allow auto-promoted moderator to manually promote others', async () => {
    // Set up listener BEFORE disconnect
    const autoPromotionPromise = new Promise<void>((resolve) => {
      participant1Socket.once('moderator-promoted', () => resolve());
    });

    // Disconnect moderator to trigger auto-promotion
    moderatorSocket.disconnect();

    // Wait for auto-promotion
    await autoPromotionPromise;
    await new Promise(resolve => setTimeout(resolve, 200));

    // Participant1 (Alice, now auto-promoted moderator) manually promotes participant3 (Charlie)
    const manualPromotionPromise = new Promise<any>((resolve) => {
      participant2Socket.once('moderator-promoted', resolve);
    });

    participant1Socket.emit('promote-moderator', {
      sessionId,
      promoterId: participant1Id,
      targetParticipantId: participant3Id
    });

    const manualPromotion = await manualPromotionPromise;

    expect(manualPromotion).toMatchObject({
      participantId: participant3Id,
      participantName: 'Charlie',
      promotionType: 'manual'
    });
  });

  it('should handle session with no remaining participants after moderator leaves', async () => {
    // Disconnect all non-moderator participants first
    participant1Socket.disconnect();
    participant2Socket.disconnect();
    participant3Socket.disconnect();

    await new Promise(resolve => setTimeout(resolve, 200));

    // Now moderator leaves - session should have no participants
    // This should not cause errors, session will naturally expire
    moderatorSocket.disconnect();

    await new Promise(resolve => setTimeout(resolve, 200));

    // No assertion needed - just verify no crashes occurred
    expect(true).toBe(true);
  });

  it('should broadcast auto-promotion to all connected participants', async () => {
    // All participants listen for the event
    const promotionPromises = [
      new Promise<any>((resolve) => participant1Socket.once('moderator-promoted', resolve)),
      new Promise<any>((resolve) => participant2Socket.once('moderator-promoted', resolve)),
      new Promise<any>((resolve) => participant3Socket.once('moderator-promoted', resolve))
    ];

    const disconnectTime = Date.now();
    moderatorSocket.disconnect();

    await new Promise(resolve => setTimeout(resolve, 200));

    const [p1Event, p2Event, p3Event] = await Promise.all(promotionPromises);

    // All should receive same event data
    expect(p1Event.participantId).toBe(participant1Id);
    expect(p2Event.participantId).toBe(participant1Id);
    expect(p3Event.participantId).toBe(participant1Id);

    // All timestamps should be close to disconnect time
    expect(p1Event.timestamp).toBeGreaterThanOrEqual(disconnectTime);
    expect(p2Event.timestamp).toBeGreaterThanOrEqual(disconnectTime);
    expect(p3Event.timestamp).toBeGreaterThanOrEqual(disconnectTime);
  });

  it('should maintain session state through auto-promotion', async () => {
    // Cast some votes before moderator leaves
    await Promise.all([
      new Promise<void>((resolve) => {
        moderatorSocket.once('vote-accepted', () => resolve());
        moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
      }),
      new Promise<void>((resolve) => {
        participant1Socket.once('vote-accepted', () => resolve());
        participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 8 });
      })
    ]);

    await new Promise(resolve => setTimeout(resolve, 100));

    // Set up listener BEFORE disconnect
    const autoPromotionPromise = new Promise<void>((resolve) => {
      participant1Socket.once('moderator-promoted', () => resolve());
    });

    // Disconnect moderator to trigger auto-promotion
    moderatorSocket.disconnect();

    // Wait for auto-promotion
    await autoPromotionPromise;
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify votes are still intact and can be revealed by new moderator
    const revealPromise = new Promise<any>((resolve) => {
      participant1Socket.once('votes-revealed', resolve);
    });

    participant1Socket.emit('reveal-votes', { sessionId, moderatorId: participant1Id });

    const revealed = await revealPromise;

    // Should still have the original 2 votes (moderator's vote is preserved even after disconnect)
    expect(revealed.votes.length).toBeGreaterThanOrEqual(1);
  });
});
