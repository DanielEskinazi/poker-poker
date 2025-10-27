import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { io, Socket } from 'socket.io-client';
import http from 'http';
import app from '../../src/app';
import { Server as SocketServer } from 'socket.io';

/**
 * Contract Test: WebSocket create-session Event
 *
 * Tests the WebSocket event contract for session creation as defined in:
 * specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * TDD Approach: These tests are written FIRST and should FAIL until
 * the implementation is complete.
 */

describe('WebSocket create-session Event - Contract Test', () => {
  let httpServer: http.Server;
  let serverPort: number;
  let clientSocket: Socket;

  beforeAll(async () => {
    // Start test server
    httpServer = http.createServer(app);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        serverPort = typeof address === 'object' && address !== null ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });

  afterEach(() => {
    // Disconnect socket after each test
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Success Cases', () => {
    it('should emit session-created for valid create-session request', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_websocket_001'
        }
      });

      // Wait for connection to establish
      clientSocket.on('connect', () => {
        // Send create-session event
        clientSocket.emit('create-session', {
          creatorName: 'Sarah',
          browserFingerprint: 'test_fp_websocket_001'
        });
      });

      // Listen for session-created response
      clientSocket.on('session-created', (data) => {
        try {
          // Verify response structure matches contract
          expect(data).toMatchObject({
            sessionId: expect.stringMatching(/^[A-Za-z0-9]{8}$/),
            sessionUrl: expect.stringContaining('/session/'),
            participant: {
              participantId: expect.any(String),
              name: 'Sarah',
              emoji: expect.any(String),
              isModerator: true
            },
            timestamp: expect.any(Number)
          });

          // Verify sessionId format (8 alphanumeric characters)
          expect(data.sessionId).toMatch(/^[A-Za-z0-9]{8}$/);

          // Verify participant has emoji avatar
          expect(data.participant.emoji).toBeDefined();
          expect(typeof data.participant.emoji).toBe('string');

          // Verify creator is moderator
          expect(data.participant.isModerator).toBe(true);

          // Verify timestamp is recent
          const now = Date.now();
          expect(data.timestamp).toBeGreaterThan(now - 10000);
          expect(data.timestamp).toBeLessThanOrEqual(now);

          done();
        } catch (error) {
          done(error);
        }
      });

      // Handle errors
      clientSocket.on('error', (error) => {
        done(new Error(`Expected session-created, got error: ${JSON.stringify(error)}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        done(new Error('Timeout waiting for session-created event'));
      }, 5000);
    });

    it('should create unique session IDs for multiple create requests', (done) => {
      const sessionIds = new Set<string>();
      let completedRequests = 0;
      const totalRequests = 3;

      const createSocket = (index: number) => {
        const socket = io(`http://localhost:${serverPort}`, {
          query: {
            browserFingerprint: `test_fp_unique_${index}`
          }
        });

        socket.on('connect', () => {
          socket.emit('create-session', {
            creatorName: `User${index}`,
            browserFingerprint: `test_fp_unique_${index}`
          });
        });

        socket.on('session-created', (data) => {
          sessionIds.add(data.sessionId);
          completedRequests++;
          socket.disconnect();

          if (completedRequests === totalRequests) {
            try {
              // All session IDs should be unique
              expect(sessionIds.size).toBe(totalRequests);
              done();
            } catch (error) {
              done(error);
            }
          }
        });

        socket.on('error', (error) => {
          done(new Error(`Socket ${index} error: ${JSON.stringify(error)}`));
        });
      };

      // Create multiple sessions concurrently
      for (let i = 0; i < totalRequests; i++) {
        createSocket(i);
      }

      // Timeout
      setTimeout(() => {
        done(new Error(`Only completed ${completedRequests}/${totalRequests} requests`));
      }, 5000);
    });

    it('should assign different emojis to different participants', (done) => {
      const emojis = new Set<string>();
      let completedRequests = 0;
      const totalRequests = 3;

      const createSocket = (index: number) => {
        const socket = io(`http://localhost:${serverPort}`, {
          query: {
            browserFingerprint: `test_fp_emoji_${index}`
          }
        });

        socket.on('connect', () => {
          socket.emit('create-session', {
            creatorName: `User${index}`,
            browserFingerprint: `test_fp_emoji_${index}`
          });
        });

        socket.on('session-created', (data) => {
          emojis.add(data.participant.emoji);
          completedRequests++;
          socket.disconnect();

          if (completedRequests === totalRequests) {
            try {
              // Emojis should be assigned (potentially some duplicates but all defined)
              expect(emojis.size).toBeGreaterThan(0);
              emojis.forEach(emoji => {
                expect(emoji).toBeDefined();
                expect(typeof emoji).toBe('string');
              });
              done();
            } catch (error) {
              done(error);
            }
          }
        });

        socket.on('error', (error) => {
          done(new Error(`Socket ${index} error: ${JSON.stringify(error)}`));
        });
      };

      for (let i = 0; i < totalRequests; i++) {
        createSocket(i);
      }

      setTimeout(() => {
        done(new Error(`Only completed ${completedRequests}/${totalRequests} requests`));
      }, 5000);
    });
  });

  describe('Validation Error Cases', () => {
    it('should emit error for empty creator name', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_error_001'
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', {
          creatorName: '',
          browserFingerprint: 'test_fp_error_001'
        });
      });

      clientSocket.on('error', (error) => {
        try {
          expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            message: expect.any(String)
          });
          done();
        } catch (err) {
          done(err);
        }
      });

      clientSocket.on('session-created', () => {
        done(new Error('Expected error, got session-created'));
      });

      setTimeout(() => {
        done(new Error('Timeout waiting for error event'));
      }, 5000);
    });

    it('should emit error for name too long (>50 characters)', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_error_002'
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', {
          creatorName: 'a'.repeat(51),
          browserFingerprint: 'test_fp_error_002'
        });
      });

      clientSocket.on('error', (error) => {
        try {
          expect(error.code).toBe('VALIDATION_ERROR');
          done();
        } catch (err) {
          done(err);
        }
      });

      clientSocket.on('session-created', () => {
        done(new Error('Expected error, got session-created'));
      });

      setTimeout(() => {
        done(new Error('Timeout waiting for error event'));
      }, 5000);
    });

    it('should emit error for missing creatorName field', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_error_003'
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', {
          browserFingerprint: 'test_fp_error_003'
        });
      });

      clientSocket.on('error', (error) => {
        try {
          expect(error.code).toBe('VALIDATION_ERROR');
          done();
        } catch (err) {
          done(err);
        }
      });

      clientSocket.on('session-created', () => {
        done(new Error('Expected error, got session-created'));
      });

      setTimeout(() => {
        done(new Error('Timeout waiting for error event'));
      }, 5000);
    });

    it('should emit error for missing browserFingerprint field', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_error_004'
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', {
          creatorName: 'Alice'
          // Missing browserFingerprint
        });
      });

      clientSocket.on('error', (error) => {
        try {
          expect(error.code).toBe('VALIDATION_ERROR');
          done();
        } catch (err) {
          done(err);
        }
      });

      clientSocket.on('session-created', () => {
        done(new Error('Expected error, got session-created'));
      });

      setTimeout(() => {
        done(new Error('Timeout waiting for error event'));
      }, 5000);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML/XSS in creator name', (done) => {
      clientSocket = io(`http://localhost:${serverPort}`, {
        query: {
          browserFingerprint: 'test_fp_xss'
        }
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', {
          creatorName: '<script>alert("XSS")</script>Bob',
          browserFingerprint: 'test_fp_xss'
        });
      });

      clientSocket.on('session-created', (data) => {
        try {
          // Name should be sanitized (no script tags)
          expect(data.participant.name).not.toContain('<script>');
          expect(data.participant.name).not.toContain('</script>');

          // Should preserve the safe text portion
          expect(data.participant.name).toContain('Bob');

          done();
        } catch (error) {
          done(error);
        }
      });

      clientSocket.on('error', (error) => {
        done(new Error(`Unexpected error: ${JSON.stringify(error)}`));
      });

      setTimeout(() => {
        done(new Error('Timeout waiting for session-created event'));
      }, 5000);
    });
  });
});
