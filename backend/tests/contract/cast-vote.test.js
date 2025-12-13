/**
 * Contract Test: WebSocket cast-vote Event
 *
 * Tests the cast-vote event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful vote cast with valid payload
 * 2. Vote change (cast different vote before reveal)
 * 3. Error when session not found
 * 4. Error when participant not found
 * 5. Error when voting state is 'revealed'
 * 6. Error with invalid card value
 * 7. Broadcast vote-count-updated to all participants
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import { sessionService } from '../../src/services/SessionService.js';
import { clearAllDisconnectTimers, setDisconnectGracePeriod } from '../../src/websocket/handlers/connectionHandlers.js';
describe('Contract: cast-vote WebSocket Event', () => {
    let httpServer;
    let ioServer;
    let serverUrl;
    let socket1;
    let socket2;
    let socket3;
    let sessionId;
    let participant1Id;
    let participant2Id;
    let participant3Id;
    beforeEach(async () => {
        clearAllDisconnectTimers();
        setDisconnectGracePeriod(10000);
        sessionService.clearAllSessions();
        const testServer = await createTestServer();
        httpServer = testServer.httpServer;
        ioServer = testServer.ioServer;
        serverUrl = testServer.serverUrl;
        // Create a session with 3 participants
        socket1 = ioClient(serverUrl, {
            query: { browserFingerprint: 'voter1-fp' }
        });
        await new Promise((resolve) => {
            socket1.once('connection-established', () => resolve());
        });
        const createSessionPromise = new Promise((resolve) => {
            socket1.once('session-created', (data) => resolve(data));
        });
        socket1.emit('create-session', {
            creatorName: 'Voter1',
            browserFingerprint: 'voter1-fp'
        });
        const sessionData = await createSessionPromise;
        sessionId = sessionData.sessionId;
        participant1Id = sessionData.participant.participantId;
        // Join with participant 2
        socket2 = ioClient(serverUrl, {
            query: { browserFingerprint: 'voter2-fp' }
        });
        await new Promise((resolve) => {
            socket2.once('connection-established', () => resolve());
        });
        const join2Promise = new Promise((resolve) => {
            socket2.once('join-accepted', (data) => resolve(data));
        });
        socket2.emit('join-session', {
            sessionId,
            name: 'Voter2',
            browserFingerprint: 'voter2-fp'
        });
        const join2Data = await join2Promise;
        participant2Id = join2Data.participant.participantId;
        // Join with participant 3
        socket3 = ioClient(serverUrl, {
            query: { browserFingerprint: 'voter3-fp' }
        });
        await new Promise((resolve) => {
            socket3.once('connection-established', () => resolve());
        });
        const join3Promise = new Promise((resolve) => {
            socket3.once('join-accepted', (data) => resolve(data));
        });
        socket3.emit('join-session', {
            sessionId,
            name: 'Voter3',
            browserFingerprint: 'voter3-fp'
        });
        const join3Data = await join3Promise;
        participant3Id = join3Data.participant.participantId;
    });
    afterEach(async () => {
        clearAllDisconnectTimers();
        if (socket1?.connected)
            socket1.disconnect();
        if (socket2?.connected)
            socket2.disconnect();
        if (socket3?.connected)
            socket3.disconnect();
        clearAllDisconnectTimers();
        await new Promise(resolve => setTimeout(resolve, 100));
        if (ioServer) {
            ioServer.close();
        }
        if (httpServer) {
            await new Promise((resolve) => {
                httpServer.close(() => resolve());
            });
        }
        clearAllDisconnectTimers();
        sessionService.clearAllSessions();
    });
    describe('Successful Vote Flow', () => {
        it('should accept valid cast-vote request and emit vote-accepted', async () => {
            const voteAcceptedPromise = new Promise((resolve) => {
                socket1.once('vote-accepted', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 5
            });
            const voteData = await voteAcceptedPromise;
            // Verify vote-accepted payload structure
            expect(voteData).toMatchObject({
                cardValue: 5,
                timestamp: expect.any(Number)
            });
        });
        // TODO: Fix race condition - listeners need to be set up before emit
        it.skip('should broadcast vote-count-updated to all participants', async () => {
            // Listen on all 3 sockets
            const updates = await Promise.all([
                new Promise((resolve) => socket1.once('vote-count-updated', resolve)),
                new Promise((resolve) => socket2.once('vote-count-updated', resolve)),
                new Promise((resolve) => socket3.once('vote-count-updated', resolve))
            ].map(p => Promise.race([p, new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))])));
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 8
            });
            // Wait for all broadcasts
            const [update1, update2, update3] = await Promise.all(updates);
            // Verify all received the same data
            for (const update of [update1, update2, update3]) {
                expect(update).toMatchObject({
                    votedCount: 1,
                    totalParticipants: 3,
                    hasVoted: {
                        [participant1Id]: true,
                        [participant2Id]: false,
                        [participant3Id]: false
                    },
                    timestamp: expect.any(Number)
                });
            }
        });
        // TODO: Fix race condition - listener needs to be set up before emit
        it.skip('should update vote count when multiple participants vote', async () => {
            // Participant 1 votes
            await new Promise((resolve) => {
                socket1.once('vote-accepted', () => resolve());
                socket1.emit('cast-vote', {
                    sessionId,
                    participantId: participant1Id,
                    cardValue: 3
                });
            });
            // Participant 2 votes
            const voteCountPromise = new Promise((resolve) => {
                socket1.once('vote-count-updated', (data) => resolve(data));
            });
            socket2.emit('cast-vote', {
                sessionId,
                participantId: participant2Id,
                cardValue: 5
            });
            const voteCount = await voteCountPromise;
            expect(voteCount).toMatchObject({
                votedCount: 2,
                totalParticipants: 3,
                hasVoted: {
                    [participant1Id]: true,
                    [participant2Id]: true,
                    [participant3Id]: false
                }
            });
        });
        it('should allow changing vote before reveal', async () => {
            // Cast initial vote
            await new Promise((resolve) => {
                socket1.once('vote-accepted', () => resolve());
                socket1.emit('cast-vote', {
                    sessionId,
                    participantId: participant1Id,
                    cardValue: 3
                });
            });
            // Change vote
            const voteAcceptedPromise = new Promise((resolve) => {
                socket1.once('vote-accepted', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 8
            });
            const voteData = await voteAcceptedPromise;
            expect(voteData.cardValue).toBe(8);
        });
        it('should accept all valid card values (1,2,3,5,8,13,21,?)', async () => {
            const cardValues = [1, 2, 3, 5, 8, 13, 21, '?'];
            for (const cardValue of cardValues) {
                const voteAcceptedPromise = new Promise((resolve) => {
                    socket1.once('vote-accepted', (data) => resolve(data));
                });
                socket1.emit('cast-vote', {
                    sessionId,
                    participantId: participant1Id,
                    cardValue
                });
                const voteData = await voteAcceptedPromise;
                expect(voteData.cardValue).toBe(cardValue);
            }
        });
    });
    describe('Error Handling', () => {
        it('should return SESSION_NOT_FOUND error for non-existent session', async () => {
            const errorPromise = new Promise((resolve) => {
                socket1.once('error', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId: 'INVALID1',
                participantId: participant1Id,
                cardValue: 5
            });
            const error = await errorPromise;
            expect(error).toMatchObject({
                code: 'SESSION_NOT_FOUND',
                message: expect.any(String)
            });
        });
        it('should return PARTICIPANT_NOT_FOUND error for non-existent participant', async () => {
            const errorPromise = new Promise((resolve) => {
                socket1.once('error', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: 'INVALID_PARTICIPANT_ID',
                cardValue: 5
            });
            const error = await errorPromise;
            expect(error).toMatchObject({
                code: 'PARTICIPANT_NOT_FOUND',
                message: expect.any(String)
            });
        });
        it('should return VALIDATION_ERROR for invalid card value', async () => {
            const errorPromise = new Promise((resolve) => {
                socket1.once('error', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 99 // Invalid value
            });
            const error = await errorPromise;
            expect(error).toMatchObject({
                code: 'VALIDATION_ERROR',
                message: expect.stringContaining('Invalid card value')
            });
        });
        it('should return VALIDATION_ERROR for missing cardValue', async () => {
            const errorPromise = new Promise((resolve) => {
                socket1.once('error', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id
                // Missing cardValue
            });
            const error = await errorPromise;
            expect(error).toMatchObject({
                code: 'VALIDATION_ERROR',
                message: expect.any(String)
            });
        });
        it('should return ALREADY_REVEALED error when voting state is revealed', async () => {
            // Cast votes first
            await new Promise((resolve) => {
                socket1.once('vote-accepted', () => resolve());
                socket1.emit('cast-vote', {
                    sessionId,
                    participantId: participant1Id,
                    cardValue: 5
                });
            });
            // Reveal votes (as moderator)
            await new Promise((resolve) => {
                socket1.once('votes-revealed', () => resolve());
                socket1.emit('reveal-votes', {
                    sessionId,
                    moderatorId: participant1Id
                });
            });
            // Try to vote after reveal
            const errorPromise = new Promise((resolve) => {
                socket1.once('error', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 8
            });
            const error = await errorPromise;
            expect(error).toMatchObject({
                code: 'ALREADY_REVEALED',
                message: expect.stringContaining('Votes already revealed')
            });
        });
    });
    describe('Vote Privacy', () => {
        it('should NOT include vote values in vote-count-updated broadcast', async () => {
            const voteCountPromise = new Promise((resolve) => {
                socket2.once('vote-count-updated', (data) => resolve(data));
            });
            socket1.emit('cast-vote', {
                sessionId,
                participantId: participant1Id,
                cardValue: 13
            });
            const voteCount = await voteCountPromise;
            // Ensure vote values are NOT exposed
            expect(voteCount.votes).toBeUndefined();
            expect(voteCount.cardValue).toBeUndefined();
            expect(voteCount).not.toHaveProperty('cardValue');
            expect(voteCount).not.toHaveProperty('votes');
            // Only counts and boolean flags should be present
            expect(voteCount).toHaveProperty('votedCount');
            expect(voteCount).toHaveProperty('totalParticipants');
            expect(voteCount).toHaveProperty('hasVoted');
        });
    });
});
//# sourceMappingURL=cast-vote.test.js.map