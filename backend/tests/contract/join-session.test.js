/**
 * Contract Test: WebSocket join-session Event
 *
 * Tests the join-session event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful join with valid payload
 * 2. Join with session not found error
 * 3. Join with session full error (20 participants)
 * 4. Join with duplicate browser fingerprint error
 * 5. Join with validation errors (missing/invalid fields)
 * 6. Broadcast participant-joined to all existing participants
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
describe('Contract: join-session WebSocket Event', () => {
    let httpServer;
    let ioServer;
    let serverUrl;
    let creatorSocket;
    let joinerSocket;
    beforeEach(async () => {
        const testServer = await createTestServer();
        httpServer = testServer.httpServer;
        ioServer = testServer.ioServer;
        serverUrl = testServer.serverUrl;
    });
    afterEach(async () => {
        if (creatorSocket?.connected) {
            creatorSocket.disconnect();
        }
        if (joinerSocket?.connected) {
            joinerSocket.disconnect();
        }
        if (httpServer) {
            await new Promise((resolve) => {
                httpServer.close(() => resolve());
            });
        }
    });
    describe('Successful Join Flow', () => {
        it('should accept valid join-session request and emit join-accepted', async () => {
            // Create a session first
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            // Now join the session with a different participant
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const joinAcceptedPromise = new Promise((resolve) => {
                joinerSocket.once('join-accepted', (data) => resolve(data));
            });
            joinerSocket.emit('join-session', {
                sessionId,
                name: 'Bob',
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const joinData = await joinAcceptedPromise;
            // Verify join-accepted payload structure
            expect(joinData).toMatchObject({
                participant: {
                    participantId: expect.any(String),
                    name: 'Bob',
                    emoji: expect.any(String),
                    isModerator: false,
                    joinTimestamp: expect.any(Number),
                    isConnected: true,
                    hasVoted: false,
                    currentVote: null
                },
                session: {
                    sessionId,
                    votingState: 'voting',
                    participantCount: 2,
                    storyDescription: expect.any(String)
                },
                timestamp: expect.any(Number)
            });
            expect(joinData.participant.name).toBe('Bob');
            expect(joinData.participant.isModerator).toBe(false);
            expect(joinData.session.participantCount).toBe(2);
        });
        it('should broadcast participant-joined to all existing participants', async () => {
            // Create a session first
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            // Set up listener BEFORE joiner connects
            const participantJoinedPromise = new Promise((resolve) => {
                creatorSocket.once('participant-joined', (data) => resolve(data));
            });
            // Join with another participant
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            joinerSocket.emit('join-session', {
                sessionId,
                name: 'Bob',
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const broadcastData = await participantJoinedPromise;
            // Verify participant-joined broadcast payload
            expect(broadcastData).toMatchObject({
                participant: {
                    participantId: expect.any(String),
                    name: 'Bob',
                    emoji: expect.any(String),
                    isModerator: false
                },
                participantCount: 2,
                timestamp: expect.any(Number)
            });
            expect(broadcastData.participant.name).toBe('Bob');
            expect(broadcastData.participantCount).toBe(2);
        });
        it('should reconnect existing participant with same browser fingerprint', async () => {
            // Create a session first
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId, participant: originalParticipant } = await createSessionPromise;
            // Disconnect the creator
            creatorSocket.disconnect();
            await new Promise(resolve => setTimeout(resolve, 100));
            // Reconnect with same fingerprint
            const reconnectSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                reconnectSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const joinAcceptedPromise = new Promise((resolve) => {
                reconnectSocket.once('join-accepted', (data) => resolve(data));
            });
            reconnectSocket.emit('join-session', {
                sessionId,
                name: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const joinData = await joinAcceptedPromise;
            // Should reconnect with same participant ID
            expect(joinData.participant.participantId).toBe(originalParticipant.participantId);
            expect(joinData.participant.name).toBe('Alice');
            expect(joinData.session.participantCount).toBe(1); // Still just 1 participant
            reconnectSocket.disconnect();
        });
    });
    describe('Error Handling', () => {
        it('should return SESSION_NOT_FOUND error for non-existent session', async () => {
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const errorPromise = new Promise((resolve) => {
                joinerSocket.once('error', (data) => resolve(data));
            });
            joinerSocket.emit('join-session', {
                sessionId: 'INVALID1',
                name: 'Bob',
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const errorData = await errorPromise;
            expect(errorData).toMatchObject({
                code: 'SESSION_NOT_FOUND',
                message: expect.any(String),
                timestamp: expect.any(Number)
            });
        });
        it('should return SESSION_FULL error when 20 participants already joined', async () => {
            // Create a session
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            // Add 19 more participants (total 20)
            const sockets = [];
            for (let i = 1; i < 20; i++) {
                const socket = ioClient(serverUrl, {
                    query: {
                        browserFingerprint: `fingerprint-${i}`
                    }
                });
                await new Promise((resolve) => {
                    socket.once('connection-established', () => resolve());
                });
                // Set up listener BEFORE emitting
                const joinPromise = new Promise((resolve) => {
                    socket.once('join-accepted', () => resolve());
                });
                socket.emit('join-session', {
                    sessionId,
                    name: `Participant ${i}`,
                    browserFingerprint: `fingerprint-${i}`
                });
                await joinPromise;
                sockets.push(socket);
            }
            // Try to add 21st participant
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'fingerprint-21'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const errorPromise = new Promise((resolve) => {
                joinerSocket.once('error', (data) => resolve(data));
            });
            joinerSocket.emit('join-session', {
                sessionId,
                name: 'Participant 21',
                browserFingerprint: 'fingerprint-21'
            });
            const errorData = await errorPromise;
            expect(errorData).toMatchObject({
                code: 'SESSION_FULL',
                message: expect.stringContaining('20'),
                timestamp: expect.any(Number)
            });
            // Cleanup
            sockets.forEach(s => s.disconnect());
        });
        it('should return ALREADY_IN_SESSION error for duplicate browser fingerprint', async () => {
            // Create a session
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            // Join with first participant
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const joinPromise = new Promise((resolve) => {
                joinerSocket.once('join-accepted', () => resolve());
            });
            joinerSocket.emit('join-session', {
                sessionId,
                name: 'Bob',
                browserFingerprint: 'joiner-fingerprint-456'
            });
            await joinPromise;
            // Try to join again with same fingerprint but different socket
            const duplicateSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                duplicateSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const errorPromise = new Promise((resolve) => {
                duplicateSocket.once('error', (data) => resolve(data));
            });
            duplicateSocket.emit('join-session', {
                sessionId,
                name: 'Bob Clone',
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const errorData = await errorPromise;
            expect(errorData).toMatchObject({
                code: 'ALREADY_IN_SESSION',
                message: expect.any(String),
                timestamp: expect.any(Number)
            });
            duplicateSocket.disconnect();
        });
        it('should return VALIDATION_ERROR for missing name', async () => {
            // Create a session first
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const errorPromise = new Promise((resolve) => {
                joinerSocket.once('error', (data) => resolve(data));
            });
            joinerSocket.emit('join-session', {
                sessionId,
                // name is missing
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const errorData = await errorPromise;
            expect(errorData).toMatchObject({
                code: 'VALIDATION_ERROR',
                message: expect.any(String),
                timestamp: expect.any(Number)
            });
        });
        it('should return VALIDATION_ERROR for name too long (>50 chars)', async () => {
            // Create a session first
            creatorSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'creator-fingerprint-123'
                }
            });
            await new Promise((resolve) => {
                creatorSocket.once('connection-established', () => resolve());
            });
            const createSessionPromise = new Promise((resolve) => {
                creatorSocket.once('session-created', (data) => resolve(data));
            });
            creatorSocket.emit('create-session', {
                creatorName: 'Alice',
                browserFingerprint: 'creator-fingerprint-123'
            });
            const { sessionId } = await createSessionPromise;
            joinerSocket = ioClient(serverUrl, {
                query: {
                    browserFingerprint: 'joiner-fingerprint-456'
                }
            });
            await new Promise((resolve) => {
                joinerSocket.once('connection-established', () => resolve());
            });
            // Set up listener BEFORE emitting
            const errorPromise = new Promise((resolve) => {
                joinerSocket.once('error', (data) => resolve(data));
            });
            joinerSocket.emit('join-session', {
                sessionId,
                name: 'A'.repeat(51), // 51 characters (too long)
                browserFingerprint: 'joiner-fingerprint-456'
            });
            const errorData = await errorPromise;
            expect(errorData).toMatchObject({
                code: 'VALIDATION_ERROR',
                message: expect.stringMatching(/name|50|character/i),
                timestamp: expect.any(Number)
            });
        });
    });
});
//# sourceMappingURL=join-session.test.js.map