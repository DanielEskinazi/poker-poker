/**
 * Integration Test: Reveal Flow
 *
 * Tests the reveal functionality across multiple scenarios:
 * - Moderator authorization
 * - Broadcasting reveal to all participants
 * - Statistics calculation (consensus, average, distribution)
 * - Preventing duplicate reveals
 * - Handling edge cases (no votes, non-moderator attempts)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
describe('Integration: Reveal Flow', () => {
    let httpServer;
    let ioServer;
    let serverUrl;
    let moderatorSocket;
    let participant1Socket;
    let participant2Socket;
    let sessionId;
    let moderatorId;
    let participant1Id;
    let participant2Id;
    beforeEach(async () => {
        const testServer = await createTestServer();
        httpServer = testServer.httpServer;
        ioServer = testServer.ioServer;
        serverUrl = testServer.serverUrl;
        // Setup session with moderator and 2 participants
        moderatorSocket = ioClient(serverUrl, { query: { browserFingerprint: 'mod-fp' } });
        await new Promise((resolve) => moderatorSocket.once('connection-established', () => resolve()));
        const sessionData = await new Promise((resolve) => {
            moderatorSocket.once('session-created', resolve);
            moderatorSocket.emit('create-session', { creatorName: 'Moderator', browserFingerprint: 'mod-fp' });
        });
        sessionId = sessionData.sessionId;
        moderatorId = sessionData.participant.participantId;
        // Participant 1
        participant1Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p1-fp' } });
        await new Promise((resolve) => participant1Socket.once('connection-established', () => resolve()));
        const join1Data = await new Promise((resolve) => {
            participant1Socket.once('join-accepted', resolve);
            participant1Socket.emit('join-session', { sessionId, name: 'Participant1', browserFingerprint: 'p1-fp' });
        });
        participant1Id = join1Data.participant.participantId;
        // Participant 2
        participant2Socket = ioClient(serverUrl, { query: { browserFingerprint: 'p2-fp' } });
        await new Promise((resolve) => participant2Socket.once('connection-established', () => resolve()));
        const join2Data = await new Promise((resolve) => {
            participant2Socket.once('join-accepted', resolve);
            participant2Socket.emit('join-session', { sessionId, name: 'Participant2', browserFingerprint: 'p2-fp' });
        });
        participant2Id = join2Data.participant.participantId;
    });
    afterEach(async () => {
        if (moderatorSocket?.connected)
            moderatorSocket.disconnect();
        if (participant1Socket?.connected)
            participant1Socket.disconnect();
        if (participant2Socket?.connected)
            participant2Socket.disconnect();
        await new Promise(resolve => setTimeout(resolve, 50));
        if (httpServer) {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    httpServer.closeAllConnections?.();
                    resolve();
                }, 1000);
                httpServer.close((err) => {
                    clearTimeout(timeout);
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
    });
    it('should broadcast reveal to all participants with correct statistics', async () => {
        // Cast votes
        await Promise.all([
            new Promise((resolve) => {
                moderatorSocket.once('vote-accepted', () => resolve());
                moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
            }),
            new Promise((resolve) => {
                participant1Socket.once('vote-accepted', () => resolve());
                participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: 8 });
            }),
            new Promise((resolve) => {
                participant2Socket.once('vote-accepted', () => resolve());
                participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 5 });
            })
        ]);
        await new Promise(resolve => setTimeout(resolve, 100));
        // Reveal votes - all participants should receive
        const revealPromises = [
            new Promise((resolve) => moderatorSocket.once('votes-revealed', resolve)),
            new Promise((resolve) => participant1Socket.once('votes-revealed', resolve)),
            new Promise((resolve) => participant2Socket.once('votes-revealed', resolve))
        ];
        moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
        const [modRevealed, p1Revealed, p2Revealed] = await Promise.all(revealPromises);
        // Verify all received same data
        for (const revealed of [modRevealed, p1Revealed, p2Revealed]) {
            expect(revealed.votes).toHaveLength(3);
            expect(revealed.statistics.consensus).toBe(false); // 5, 8, 5 - no consensus
            expect(revealed.statistics.averageNumeric).toBeCloseTo(6, 0); // (5+8+5)/3
            expect(revealed.statistics.distribution).toEqual({ '5': 2, '8': 1 });
            expect(revealed.timestamp).toBeDefined();
        }
    });
    it('should only allow moderator to reveal votes', async () => {
        // Cast a vote
        await new Promise((resolve) => {
            moderatorSocket.once('vote-accepted', () => resolve());
            moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        // Non-moderator tries to reveal
        const errorPromise = new Promise((resolve) => {
            participant1Socket.once('error', resolve);
        });
        participant1Socket.emit('reveal-votes', { sessionId, moderatorId: participant1Id });
        const error = await errorPromise;
        expect(error.code).toBe('NOT_MODERATOR');
    });
    it('should handle "?" votes in statistics', async () => {
        // Cast mixed votes including "?"
        await Promise.all([
            new Promise((resolve) => {
                moderatorSocket.once('vote-accepted', () => resolve());
                moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
            }),
            new Promise((resolve) => {
                participant1Socket.once('vote-accepted', () => resolve());
                participant1Socket.emit('cast-vote', { sessionId, participantId: participant1Id, cardValue: '?' });
            }),
            new Promise((resolve) => {
                participant2Socket.once('vote-accepted', () => resolve());
                participant2Socket.emit('cast-vote', { sessionId, participantId: participant2Id, cardValue: 8 });
            })
        ]);
        await new Promise(resolve => setTimeout(resolve, 100));
        const revealPromise = new Promise((resolve) => {
            moderatorSocket.once('votes-revealed', resolve);
        });
        moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
        const revealed = await revealPromise;
        expect(revealed.votes).toHaveLength(3);
        expect(revealed.statistics.distribution['?']).toBe(1);
        expect(revealed.statistics.averageNumeric).toBeCloseTo(6.5, 1); // (5+8)/2 - excludes "?"
    });
    it('should prevent revealing twice without reset', async () => {
        // Cast and reveal
        await new Promise((resolve) => {
            moderatorSocket.once('vote-accepted', () => resolve());
            moderatorSocket.emit('cast-vote', { sessionId, participantId: moderatorId, cardValue: 5 });
        });
        await new Promise(resolve => setTimeout(resolve, 50));
        await new Promise((resolve) => {
            moderatorSocket.once('votes-revealed', () => resolve());
            moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
        });
        // Try to reveal again
        const errorPromise = new Promise((resolve) => {
            moderatorSocket.once('error', resolve);
        });
        moderatorSocket.emit('reveal-votes', { sessionId, moderatorId });
        const error = await errorPromise;
        expect(error.code).toBe('ALREADY_REVEALED');
    });
});
//# sourceMappingURL=reveal-flow.test.js.map