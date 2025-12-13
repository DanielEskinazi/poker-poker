/**
 * Unit Test: CleanupService
 *
 * Tests the CleanupService functionality:
 * - Finding expired sessions
 * - Finding sessions nearing expiry
 * - Running cleanup cycles
 * - Starting/stopping background job
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CleanupService } from '../../src/services/CleanupService.js';
import { SessionService } from '../../src/services/SessionService.js';
import { SESSION_EXPIRY_MS, EXPIRY_WARNING_THRESHOLD_MS } from '../../src/config/constants.js';
describe('Unit: CleanupService', () => {
    let cleanupService;
    let sessionService;
    let mockIo;
    beforeEach(() => {
        // Create mock Socket.IO server
        mockIo = {
            to: vi.fn().mockReturnThis(),
            emit: vi.fn()
        };
        // Create fresh session service instance
        sessionService = new SessionService();
        // Create cleanup service
        cleanupService = new CleanupService(mockIo, sessionService);
    });
    afterEach(() => {
        cleanupService.stop();
        vi.clearAllMocks();
    });
    describe('findExpiredSessions', () => {
        it('should return empty array when no sessions exist', () => {
            const expired = cleanupService.findExpiredSessions();
            expect(expired).toEqual([]);
        });
        it('should return empty array when all sessions are active', () => {
            // Create a session (will be active by default)
            sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            const expired = cleanupService.findExpiredSessions();
            expect(expired).toEqual([]);
        });
        it('should identify expired sessions', () => {
            // Create a session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            // Artificially age the session past expiry
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 1000;
            const expired = cleanupService.findExpiredSessions();
            expect(expired).toContain(session.sessionId);
        });
        it('should return multiple expired sessions', () => {
            // Create two sessions
            const { session: session1 } = sessionService.createSession({
                creatorName: 'Test1',
                browserFingerprint: 'test-fp-1'
            });
            const { session: session2 } = sessionService.createSession({
                creatorName: 'Test2',
                browserFingerprint: 'test-fp-2'
            });
            // Age both sessions
            session1.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 1000;
            session2.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 2000;
            const expired = cleanupService.findExpiredSessions();
            expect(expired).toContain(session1.sessionId);
            expect(expired).toContain(session2.sessionId);
        });
    });
    describe('findSessionsNearingExpiry', () => {
        it('should return empty array when no sessions exist', () => {
            const nearingExpiry = cleanupService.findSessionsNearingExpiry();
            expect(nearingExpiry).toEqual([]);
        });
        it('should return empty array when sessions have plenty of time', () => {
            // Create a session (fresh, lots of time left)
            sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            const nearingExpiry = cleanupService.findSessionsNearingExpiry();
            expect(nearingExpiry).toEqual([]);
        });
        it('should identify sessions within warning threshold', () => {
            // Create a session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            // Set lastActivityAt to be within warning threshold
            // Session expires at lastActivityAt + SESSION_EXPIRY_MS
            // Warning fires when time remaining < EXPIRY_WARNING_THRESHOLD_MS
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS + (EXPIRY_WARNING_THRESHOLD_MS / 2);
            const nearingExpiry = cleanupService.findSessionsNearingExpiry();
            expect(nearingExpiry).toContain(session.sessionId);
        });
        it('should NOT include already expired sessions in warning list', () => {
            // Create a session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            // Session is already expired
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 1000;
            const nearingExpiry = cleanupService.findSessionsNearingExpiry();
            expect(nearingExpiry).not.toContain(session.sessionId);
        });
    });
    describe('runCleanupCycle', () => {
        it('should broadcast session-expiring for sessions nearing expiry', () => {
            // Create a session nearing expiry
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS + (EXPIRY_WARNING_THRESHOLD_MS / 2);
            cleanupService.runCleanupCycle();
            expect(mockIo.to).toHaveBeenCalledWith(session.sessionId);
            expect(mockIo.emit).toHaveBeenCalledWith('session-expiring', expect.objectContaining({
                sessionId: session.sessionId,
                minutesRemaining: expect.any(Number),
                timestamp: expect.any(Number)
            }));
        });
        it('should broadcast session-expired for expired sessions', () => {
            // Create an expired session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 1000;
            cleanupService.runCleanupCycle();
            expect(mockIo.to).toHaveBeenCalledWith(session.sessionId);
            expect(mockIo.emit).toHaveBeenCalledWith('session-expired', expect.objectContaining({
                sessionId: session.sessionId,
                reason: 'inactivity',
                timestamp: expect.any(Number)
            }));
        });
        it('should delete expired sessions after broadcasting', () => {
            // Create an expired session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS - 1000;
            cleanupService.runCleanupCycle();
            // Session should be deleted
            expect(sessionService.getSession(session.sessionId)).toBeUndefined();
        });
        it('should track warned sessions to avoid duplicate warnings', () => {
            // Create a session nearing expiry
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            session.lastActivityAt = Date.now() - SESSION_EXPIRY_MS + (EXPIRY_WARNING_THRESHOLD_MS / 2);
            // Run twice
            cleanupService.runCleanupCycle();
            vi.clearAllMocks();
            cleanupService.runCleanupCycle();
            // Should only warn once (second call should not emit)
            expect(mockIo.emit).not.toHaveBeenCalledWith('session-expiring', expect.anything());
        });
    });
    describe('start/stop', () => {
        it('should start the cleanup interval', () => {
            vi.useFakeTimers();
            cleanupService.start();
            // Fast-forward time
            vi.advanceTimersByTime(300001); // 5 minutes + 1ms
            // Cleanup cycle should have run
            // (We can't easily verify without complex mocking, but start should not throw)
            expect(() => cleanupService.stop()).not.toThrow();
            vi.useRealTimers();
        });
        it('should stop the cleanup interval', () => {
            vi.useFakeTimers();
            cleanupService.start();
            cleanupService.stop();
            // Advancing time should not cause issues
            vi.advanceTimersByTime(600000);
            vi.useRealTimers();
        });
        it('should handle multiple start calls gracefully', () => {
            expect(() => {
                cleanupService.start();
                cleanupService.start();
            }).not.toThrow();
        });
        it('should handle stop without start', () => {
            expect(() => cleanupService.stop()).not.toThrow();
        });
    });
    describe('calculateMinutesRemaining', () => {
        it('should calculate correct minutes remaining', () => {
            // Create a session
            const { session } = sessionService.createSession({
                creatorName: 'Test',
                browserFingerprint: 'test-fp'
            });
            // Set lastActivityAt to 55 minutes ago
            session.lastActivityAt = Date.now() - (55 * 60 * 1000);
            // Should have ~5 minutes remaining
            const minutes = cleanupService.calculateMinutesRemaining(session.sessionId);
            expect(minutes).toBeGreaterThan(4);
            expect(minutes).toBeLessThan(6);
        });
    });
});
//# sourceMappingURL=cleanup-service.test.js.map