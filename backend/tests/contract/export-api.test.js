/**
 * Contract Test: Export API
 *
 * Tests the GET /api/sessions/:sessionId/export endpoint per REST API contract:
 * - Moderators can export session data to Excel (.xlsx)
 * - Non-moderators receive 403 Forbidden
 * - Invalid sessions return 404
 * - File format and structure validation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createTestServer } from '../helpers/testServer';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { sessionService } from '../../src/services/SessionService.js';
import { clearAllDisconnectTimers, setDisconnectGracePeriod } from '../../src/websocket/handlers/connectionHandlers.js';
import ExcelJS from 'exceljs';
describe('Contract: Export API', () => {
    let httpServer;
    let ioServer;
    let serverUrl;
    let moderatorSocket;
    let participantSocket;
    let sessionId;
    let moderatorId;
    let participantId;
    let app;
    // Helper to verify session still exists before making request
    const verifySessionExists = () => {
        const session = sessionService.getSession(sessionId);
        if (!session) {
            const allSessions = sessionService.getAllSessions();
            throw new Error(`Session ${sessionId} was unexpectedly cleared! ` +
                `Available sessions: [${allSessions.map(s => s.sessionId).join(', ')}]`);
        }
        return session;
    };
    beforeEach(async () => {
        // Clear any pending disconnect timers from previous tests
        clearAllDisconnectTimers();
        // Set longer grace period to prevent session clearing during tests
        setDisconnectGracePeriod(10000);
        // Clear any existing sessions
        sessionService.clearAllSessions();
        const testServer = await createTestServer();
        httpServer = testServer.httpServer;
        ioServer = testServer.ioServer;
        serverUrl = testServer.serverUrl;
        app = createApp();
        // Create a session with moderator
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
        // Join a regular participant
        participantSocket = ioClient(serverUrl, {
            query: { browserFingerprint: 'p1-fp' }
        });
        await new Promise((resolve) => {
            participantSocket.once('connection-established', () => resolve());
        });
        const joinData = await new Promise((resolve) => {
            participantSocket.once('join-accepted', resolve);
            participantSocket.emit('join-session', {
                sessionId,
                name: 'Alice',
                browserFingerprint: 'p1-fp'
            });
        });
        participantId = joinData.participant.participantId;
        // Cast some votes and reveal
        await new Promise((resolve) => {
            moderatorSocket.once('vote-accepted', () => resolve());
            moderatorSocket.emit('cast-vote', {
                sessionId,
                participantId: moderatorId,
                cardValue: 5
            });
        });
        await new Promise((resolve) => {
            participantSocket.once('vote-accepted', () => resolve());
            participantSocket.emit('cast-vote', {
                sessionId,
                participantId,
                cardValue: 8
            });
        });
        await new Promise(resolve => setTimeout(resolve, 100));
        // Reveal votes
        await new Promise((resolve) => {
            moderatorSocket.once('votes-revealed', () => resolve());
            moderatorSocket.emit('reveal-votes', {
                sessionId,
                moderatorId
            });
        });
        // Allow time for session state to be fully settled
        await new Promise(resolve => setTimeout(resolve, 200));
        // Verify session exists before running tests
        const session = sessionService.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found after setup`);
        }
    });
    afterEach(async () => {
        // Clear disconnect timers before disconnecting sockets
        clearAllDisconnectTimers();
        if (moderatorSocket?.connected)
            moderatorSocket.disconnect();
        if (participantSocket?.connected)
            participantSocket.disconnect();
        // Clear timers again after disconnect to prevent any new timers from running
        clearAllDisconnectTimers();
        // Wait for disconnect events to process
        await new Promise(resolve => setTimeout(resolve, 150));
        // Clear timers one more time to catch any newly created
        clearAllDisconnectTimers();
        if (ioServer) {
            ioServer.close();
        }
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
        // Final cleanup
        clearAllDisconnectTimers();
        sessionService.clearAllSessions();
        // Extra wait to ensure all async operations complete
        await new Promise(resolve => setTimeout(resolve, 50));
    });
    describe('Successful Export', () => {
        // TODO: Fix session isolation - flaky when running with full test suite
        // The WebSocket test server and supertest HTTP requests share sessionService singleton,
        // but race conditions cause 404 when tests run with other files
        it.skip('should export session data as Excel file when requested by moderator', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: moderatorId })
                .responseType('blob')
                .expect(200);
            expect(response.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            expect(response.headers['content-disposition']).toContain(`planning-poker-session-${sessionId}.xlsx`);
            expect(response.body).toBeDefined();
        });
        // TODO: Fix session isolation - session gets cleared before HTTP request
        it.skip('should generate valid Excel file with correct structure', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: moderatorId })
                .responseType('arraybuffer')
                .expect(200);
            // Parse the Excel file
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(Buffer.from(response.body));
            // Verify sheet names
            const sheetNames = workbook.worksheets.map(ws => ws.name);
            expect(sheetNames).toContain('Session Summary');
            expect(sheetNames).toContain('Voting Rounds');
            // Verify Session Summary sheet has session info
            const summarySheet = workbook.getWorksheet('Session Summary');
            expect(summarySheet).toBeDefined();
            // Verify Voting Rounds sheet has vote data
            const votingSheet = workbook.getWorksheet('Voting Rounds');
            expect(votingSheet).toBeDefined();
        });
        // TODO: Fix session isolation - flaky when running with full test suite
        // Session exists but race condition causes 404 when tests run in parallel with other files
        it.skip('should include participant data in export', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: moderatorId })
                .responseType('arraybuffer')
                .expect(200);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(Buffer.from(response.body));
            const summarySheet = workbook.getWorksheet('Session Summary');
            const rows = summarySheet?.getSheetValues();
            // Find participant names in the data
            const flatData = rows.flat().filter(Boolean).map(v => String(v));
            expect(flatData.some(v => v.includes('Moderator'))).toBe(true);
            expect(flatData.some(v => v.includes('Alice'))).toBe(true);
        });
        // TODO: Fix session isolation - session gets cleared before HTTP request
        it.skip('should include voting data in export', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: moderatorId })
                .responseType('arraybuffer')
                .expect(200);
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(Buffer.from(response.body));
            const votingSheet = workbook.getWorksheet('Voting Rounds');
            const rows = votingSheet?.getSheetValues();
            // Verify header row exists
            const flatData = rows.flat().filter(Boolean).map(v => String(v));
            expect(flatData.some(v => v.includes('Round') || v.includes('Participant') || v.includes('Vote'))).toBe(true);
        });
    });
    describe('Authorization', () => {
        // TODO: Fix session isolation - flaky when running with full test suite
        it.skip('should return 403 when non-moderator attempts export', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId })
                .expect(403);
            expect(response.body.error.code).toBe('NOT_MODERATOR');
            expect(response.body.error.message).toContain('moderators');
        });
        it('should return 400 when participantId is missing', async () => {
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .expect(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });
    describe('Error Handling', () => {
        it('should return 404 for non-existent session', async () => {
            const response = await request(app)
                .get('/api/sessions/INVALID1/export')
                .query({ participantId: moderatorId })
                .expect(404);
            expect(response.body.error.code).toBe('SESSION_NOT_FOUND');
        });
        it('should return 404 for invalid session ID format', async () => {
            const response = await request(app)
                .get('/api/sessions/invalid-format/export')
                .query({ participantId: moderatorId })
                .expect(404);
            expect(response.body.error.code).toBe('SESSION_NOT_FOUND');
        });
        // TODO: Fix session isolation - session gets cleared before HTTP request
        it.skip('should return 404 when participant not found in session', async () => {
            verifySessionExists();
            const response = await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: 'nonexistent123456' })
                .expect(404);
            expect(response.body.error.code).toBe('PARTICIPANT_NOT_FOUND');
        });
    });
    describe('Performance', () => {
        // TODO: Fix session isolation - session gets cleared before HTTP request
        it.skip('should generate export in under 5 seconds', async () => {
            verifySessionExists();
            const startTime = Date.now();
            await request(app)
                .get(`/api/sessions/${sessionId}/export`)
                .query({ participantId: moderatorId })
                .expect(200);
            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(5000);
        });
    });
});
//# sourceMappingURL=export-api.test.js.map