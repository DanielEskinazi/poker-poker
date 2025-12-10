import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import http from 'http';
/**
 * Contract Test: POST /api/sessions
 *
 * Tests the REST API contract for session creation as defined in:
 * specs/001-anonymous-planning-poker/contracts/rest-api.md
 *
 * TDD Approach: These tests are written FIRST and should FAIL until
 * the implementation is complete.
 */
describe('POST /api/sessions - Contract Test', () => {
    let server;
    beforeAll(async () => {
        // Start test server on a different port to avoid conflicts
        server = http.createServer(app);
        await new Promise((resolve) => {
            server.listen(0, () => resolve());
        });
    });
    afterAll(async () => {
        await new Promise((resolve, reject) => {
            server.close((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    });
    describe('Success Cases', () => {
        it('should return 201 with session data for valid input', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: 'Sarah',
                browserFingerprint: 'test_fp_001'
            })
                .expect(201);
            // Verify response structure matches contract
            expect(response.body).toMatchObject({
                sessionId: expect.stringMatching(/^[A-Za-z0-9]{8}$/),
                sessionUrl: expect.stringContaining('/session/'),
                participant: {
                    participantId: expect.any(String),
                    name: 'Sarah',
                    emoji: expect.any(String),
                    isModerator: true
                },
                createdAt: expect.any(Number)
            });
            // Verify sessionId format (8 alphanumeric characters)
            expect(response.body.sessionId).toMatch(/^[A-Za-z0-9]{8}$/);
            // Verify participant emoji is a valid emoji (Unicode character)
            expect(response.body.participant.emoji).toMatch(/[\u{1F000}-\u{1F9FF}]/u);
            // Verify createdAt is a reasonable Unix timestamp
            const now = Date.now();
            expect(response.body.createdAt).toBeGreaterThan(now - 10000); // Within last 10 seconds
            expect(response.body.createdAt).toBeLessThanOrEqual(now);
        });
        it('should create unique session IDs for concurrent requests', async () => {
            const requests = Array(5).fill(null).map((_, i) => request(server)
                .post('/api/sessions')
                .send({
                creatorName: `User${i}`,
                browserFingerprint: `test_fp_concurrent_${i}`
            }));
            const responses = await Promise.all(requests);
            // All should succeed
            responses.forEach(res => {
                expect(res.status).toBe(201);
            });
            // All session IDs should be unique
            const sessionIds = responses.map(res => res.body.sessionId);
            const uniqueIds = new Set(sessionIds);
            expect(uniqueIds.size).toBe(5);
        });
        it('should assign emoji avatar to creator', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: 'John',
                browserFingerprint: 'test_fp_emoji'
            })
                .expect(201);
            expect(response.body.participant.emoji).toBeDefined();
            expect(typeof response.body.participant.emoji).toBe('string');
            expect(response.body.participant.emoji.length).toBeGreaterThan(0);
        });
    });
    describe('Validation Error Cases', () => {
        it('should return 400 for empty creator name', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: '',
                browserFingerprint: 'test_fp_002'
            })
                .expect(400);
            expect(response.body.error).toBeDefined();
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.field).toBe('creatorName');
            expect(response.body.error.message).toContain('1-50 characters');
        });
        it('should return 400 for name too long (>50 characters)', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: 'a'.repeat(51), // 51 characters
                browserFingerprint: 'test_fp_003'
            })
                .expect(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.field).toBe('creatorName');
        });
        it('should return 400 for missing creatorName field', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                browserFingerprint: 'test_fp_004'
            })
                .expect(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.field).toBe('creatorName');
        });
        it('should return 400 for missing browserFingerprint field', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: 'Alice'
            })
                .expect(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
            expect(response.body.error.field).toBe('browserFingerprint');
        });
        it('should return 400 for invalid content type', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .set('Content-Type', 'text/plain')
                .send('invalid data')
                .expect(400);
            expect(response.body.error).toBeDefined();
        });
    });
    describe('Sanitization', () => {
        it('should sanitize HTML/XSS in creator name', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: '<script>alert("XSS")</script>Bob',
                browserFingerprint: 'test_fp_xss'
            })
                .expect(201);
            // Name should be sanitized (no script tags)
            expect(response.body.participant.name).not.toContain('<script>');
            expect(response.body.participant.name).not.toContain('</script>');
            // Should preserve the safe text portion
            expect(response.body.participant.name).toContain('Bob');
        });
        it('should trim whitespace from creator name', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: '  Alice  ',
                browserFingerprint: 'test_fp_trim'
            })
                .expect(201);
            expect(response.body.participant.name).toBe('Alice');
        });
    });
    describe('Error Response Format', () => {
        it('should return consistent error format for validation errors', async () => {
            const response = await request(server)
                .post('/api/sessions')
                .send({
                creatorName: '',
                browserFingerprint: 'test_fp_error_format'
            })
                .expect(400);
            // Verify error structure matches contract
            expect(response.body.error).toMatchObject({
                code: expect.any(String),
                message: expect.any(String),
                field: expect.any(String),
                timestamp: expect.any(Number)
            });
            // Verify timestamp is recent
            const now = Date.now();
            expect(response.body.error.timestamp).toBeGreaterThan(now - 10000);
            expect(response.body.error.timestamp).toBeLessThanOrEqual(now);
        });
    });
});
//# sourceMappingURL=create-session.test.js.map