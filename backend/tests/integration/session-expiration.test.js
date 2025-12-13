/**
 * Integration Test: Session Expiration
 *
 * Tests the session lifecycle and expiration workflow:
 * - Sessions expire based on lastActivityAt + expiryTime
 * - Warning event sent before expiration
 * - Session-expired event broadcast when session expires
 * - Cleanup service removes expired sessions
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import { CleanupService } from '../../src/services/CleanupService.js';
import { sessionService } from '../../src/services/SessionService.js';
describe('Integration: Session Expiration', () => {
    let httpServer;
    let ioServer;
    let serverUrl;
    let moderatorSocket;
    let participant1Socket;
    let sessionId;
    let moderatorId;
    let cleanupService;
    beforeEach(async () => {
        const testServer = await createTestServer();
        httpServer = testServer.httpServer;
        ioServer = testServer.ioServer;
        serverUrl = testServer.serverUrl;
        // Create cleanup service for testing
        cleanupService = new CleanupService(ioServer, sessionService);
        // Create a session
        moderatorSocket = ioClient(serverUrl, {
            query: { browserFingerprint: 'mod-fp' }
        });
        await new Promise((resolve) => {
            moderatorSocket.once('connection-established', () => resolve());
        });
        const sessionData = await new Promise((resolve) => {
            moderatorSocket.once('session-created', resolve);
            moderatorSocket.emit('create-session', {
                creatorName: 'Moderator',
                browserFingerprint: 'mod-fp'
            });
        });
        sessionId = sessionData.sessionId;
        moderatorId = sessionData.participant.participantId;
        // Join with participant1
        participant1Socket = ioClient(serverUrl, {
            query: { browserFingerprint: 'p1-fp' }
        });
        await new Promise((resolve) => {
            participant1Socket.once('connection-established', () => resolve());
        });
        await new Promise((resolve) => {
            participant1Socket.once('join-accepted', resolve);
            participant1Socket.emit('join-session', {
                sessionId,
                name: 'Alice',
                browserFingerprint: 'p1-fp'
            });
        });
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    afterEach(async () => {
        // Stop cleanup service
        cleanupService?.stop();
        if (moderatorSocket?.connected)
            moderatorSocket.disconnect();
        if (participant1Socket?.connected)
            participant1Socket.disconnect();
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
    describe('Session Activity Tracking', () => {
        it('should update lastActivityAt on session creation', () => {
            const session = sessionService.getSession(sessionId);
            expect(session).toBeDefined();
            expect(session.lastActivityAt).toBeDefined();
            expect(session.lastActivityAt).toBeLessThanOrEqual(Date.now());
        });
        it('should update lastActivityAt on vote cast', async () => {
            const sessionBefore = sessionService.getSession(sessionId);
            const lastActivityBefore = sessionBefore.lastActivityAt;
            await new Promise(resolve => setTimeout(resolve, 50));
            // Cast a vote
            await new Promise((resolve) => {
                moderatorSocket.once('vote-accepted', () => resolve());
                moderatorSocket.emit('cast-vote', {
                    sessionId,
                    participantId: moderatorId,
                    cardValue: 5
                });
            });
            const sessionAfter = sessionService.getSession(sessionId);
            expect(sessionAfter.lastActivityAt).toBeGreaterThanOrEqual(lastActivityBefore);
        });
        it('should update lastActivityAt on votes revealed', async () => {
            // Cast a vote first
            await new Promise((resolve) => {
                moderatorSocket.once('vote-accepted', () => resolve());
                moderatorSocket.emit('cast-vote', {
                    sessionId,
                    participantId: moderatorId,
                    cardValue: 5
                });
            });
            const sessionBefore = sessionService.getSession(sessionId);
            const lastActivityBefore = sessionBefore.lastActivityAt;
            await new Promise(resolve => setTimeout(resolve, 50));
            // Reveal votes
            await new Promise((resolve) => {
                moderatorSocket.once('votes-revealed', () => resolve());
                moderatorSocket.emit('reveal-votes', {
                    sessionId,
                    moderatorId
                });
            });
            const sessionAfter = sessionService.getSession(sessionId);
            expect(sessionAfter.lastActivityAt).toBeGreaterThanOrEqual(lastActivityBefore);
        });
    });
    describe('Session Expiration Detection', () => {
        it('should identify sessions past expiry time', () => {
            const session = sessionService.getSession(sessionId);
            expect(session).toBeDefined();
            // Manually set lastActivityAt to past expiry time
            session.lastActivityAt = Date.now() - 3700000; // 1 hour + 100 seconds ago
            const expiredSessions = cleanupService.findExpiredSessions();
            expect(expiredSessions).toContain(sessionId);
        });
        it('should identify sessions approaching expiry', () => {
            const session = sessionService.getSession(sessionId);
            expect(session).toBeDefined();
            // Set lastActivityAt to 56 minutes ago (4 minutes before expiry, within 5-min warning)
            session.lastActivityAt = Date.now() - 3360000;
            const warningSessions = cleanupService.findSessionsNearingExpiry();
            expect(warningSessions).toContain(sessionId);
        });
        it('should NOT identify active sessions as expired', () => {
            const session = sessionService.getSession(sessionId);
            expect(session).toBeDefined();
            // Session is freshly created, should not be expired
            const expiredSessions = cleanupService.findExpiredSessions();
            expect(expiredSessions).not.toContain(sessionId);
        });
    });
    describe('Expiry Warning Events', () => {
        it('should broadcast session-expiring event to all participants', async () => {
            const session = sessionService.getSession(sessionId);
            // Set lastActivityAt to 56 minutes ago
            session.lastActivityAt = Date.now() - 3360000;
            // Set up listeners
            const warningPromises = [
                new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                    moderatorSocket.once('session-expiring', (data) => {
                        clearTimeout(timeout);
                        resolve(data);
                    });
                }),
                new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                    participant1Socket.once('session-expiring', (data) => {
                        clearTimeout(timeout);
                        resolve(data);
                    });
                })
            ];
            // Trigger cleanup cycle
            cleanupService.runCleanupCycle();
            const [modWarning, p1Warning] = await Promise.all(warningPromises);
            expect(modWarning).toMatchObject({
                sessionId,
                minutesRemaining: expect.any(Number),
                timestamp: expect.any(Number)
            });
            expect(p1Warning).toMatchObject({
                sessionId,
                minutesRemaining: expect.any(Number),
                timestamp: expect.any(Number)
            });
        });
    });
    describe('Session Expiration Events', () => {
        it('should broadcast session-expired event when session expires', async () => {
            const session = sessionService.getSession(sessionId);
            // Set lastActivityAt to past expiry time
            session.lastActivityAt = Date.now() - 3700000;
            // Set up listeners
            const expiredPromises = [
                new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                    moderatorSocket.once('session-expired', (data) => {
                        clearTimeout(timeout);
                        resolve(data);
                    });
                }),
                new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                    participant1Socket.once('session-expired', (data) => {
                        clearTimeout(timeout);
                        resolve(data);
                    });
                })
            ];
            // Trigger cleanup cycle
            cleanupService.runCleanupCycle();
            const [modExpired, p1Expired] = await Promise.all(expiredPromises);
            expect(modExpired).toMatchObject({
                sessionId,
                reason: 'inactivity',
                timestamp: expect.any(Number)
            });
            expect(p1Expired).toMatchObject({
                sessionId,
                reason: 'inactivity',
                timestamp: expect.any(Number)
            });
        });
        it('should remove expired session from service after broadcasting', async () => {
            const session = sessionService.getSession(sessionId);
            // Set lastActivityAt to past expiry time
            session.lastActivityAt = Date.now() - 3700000;
            // Set up listener BEFORE triggering cleanup
            const expiredPromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
                moderatorSocket.once('session-expired', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            // Trigger cleanup cycle
            cleanupService.runCleanupCycle();
            // Wait for session-expired event
            await expiredPromise;
            await new Promise(resolve => setTimeout(resolve, 100));
            // Session should be removed
            const deletedSession = sessionService.getSession(sessionId);
            expect(deletedSession).toBeUndefined();
        });
    });
    describe('Activity Extends Session Life', () => {
        it('should NOT expire session with recent activity', () => {
            const session = sessionService.getSession(sessionId);
            // Update last activity to now
            session.lastActivityAt = Date.now();
            // Check that session is not identified as expired
            const expiredSessions = cleanupService.findExpiredSessions();
            expect(expiredSessions).not.toContain(sessionId);
        });
    });
});
//# sourceMappingURL=session-expiration.test.js.map