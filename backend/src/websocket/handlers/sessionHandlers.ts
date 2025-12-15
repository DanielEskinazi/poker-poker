import { Socket } from 'socket.io';
import { sessionService } from '../../services/SessionService.js';
import { participantService } from '../../services/ParticipantService.js';
import { validateNameDetailed, sanitizeName, validateBrowserFingerprint, validateSessionIdFormat } from '../../utils/validation.js';
import { logWebSocketEvent, logError } from '../../utils/logger.js';
import { env } from '../../config/environment.js';

/**
 * WebSocket Session Handlers
 *
 * Implements WebSocket event handlers for session management as defined in:
 * specs/001-anonymous-planning-poker/contracts/websocket-events.md
 */

/**
 * Handle create-session event
 *
 * Creates a new Planning Poker session and makes the creator the first moderator.
 */
export function handleCreateSession(socket: Socket) {
  socket.on('create-session', async (data, callback) => {
    try {
      logWebSocketEvent('create-session', socket.id, data);

      const { creatorName, browserFingerprint } = data;

      // Validate required fields
      if (!creatorName) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Name is required and must be 1-50 characters',
          field: 'creatorName'
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      if (!browserFingerprint) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Browser fingerprint is required',
          field: 'browserFingerprint'
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Validate browser fingerprint
      const fingerprintValidation = validateBrowserFingerprint(browserFingerprint);
      if (!fingerprintValidation.valid) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: fingerprintValidation.error || 'Invalid browser fingerprint',
          field: 'browserFingerprint'
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Sanitize and validate name
      const sanitizedName = sanitizeName(creatorName);
      const nameValidation = validateNameDetailed(sanitizedName);

      if (!nameValidation.valid) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: nameValidation.error || 'Name must be 1-50 characters',
          field: 'creatorName'
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Create session using SessionService
      const result = sessionService.createSession({
        creatorName: nameValidation.sanitized!,
        browserFingerprint
      });

      // Join the socket to the session room
      await socket.join(result.session.sessionId);

      // Store participant ID and session ID in socket data for future events
      socket.data.participantId = result.participant.participantId;
      socket.data.sessionId = result.session.sessionId;

      // Add socket ID to participant's socket set
      result.participant.socketIds.add(socket.id);

      // Construct session URL
      const protocol = env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = env.HOST || 'localhost';
      const port = env.PORT || 3000;
      const sessionUrl = env.NODE_ENV === 'production'
        ? `${protocol}://${host}/session/${result.session.sessionId}`
        : `${protocol}://${host}:${port}/session/${result.session.sessionId}`;

      // Emit session-created event to the creator
      const response = {
        sessionId: result.session.sessionId,
        sessionUrl,
        participant: {
          participantId: result.participant.participantId,
          name: result.participant.name,
          emoji: result.participant.emoji,
          isModerator: result.participant.isModerator
        },
        timestamp: Date.now()
      };

      socket.emit('session-created', response);
      if (callback) callback(response);

      logWebSocketEvent('session-created', socket.id, {
        sessionId: result.session.sessionId,
        participantId: result.participant.participantId
      });

    } catch (error) {
      logError('Error creating session via WebSocket', error as Error, { socketId: socket.id });

      const errorResponse = {
        code: 'SERVER_ERROR',
        message: 'Failed to create session'
      };

      socket.emit('error', errorResponse);
      if (callback) callback({ error: errorResponse });
    }
  });
}

/**
 * Handle join-session event
 *
 * Allows a participant to join an existing session.
 */
export function handleJoinSession(socket: Socket) {
  socket.on('join-session', async (data, callback) => {
    try {
      logWebSocketEvent('join-session', socket.id, data);

      const { sessionId, name, browserFingerprint } = data;

      // Validate required fields
      if (!sessionId) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Session ID is required',
          field: 'sessionId',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      if (!name) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Name is required and must be 1-50 characters',
          field: 'name',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      if (!browserFingerprint) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: 'Browser fingerprint is required',
          field: 'browserFingerprint',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Validate session ID format
      const sessionIdValidation = validateSessionIdFormat(sessionId);
      if (!sessionIdValidation.valid) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: sessionIdValidation.error || 'Invalid session ID format',
          field: 'sessionId',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Validate browser fingerprint
      const fingerprintValidation = validateBrowserFingerprint(browserFingerprint);
      if (!fingerprintValidation.valid) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: fingerprintValidation.error || 'Invalid browser fingerprint',
          field: 'browserFingerprint',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Sanitize and validate name
      const sanitizedName = sanitizeName(name);
      const nameValidation = validateNameDetailed(sanitizedName);

      if (!nameValidation.valid) {
        const errorResponse = {
          code: 'VALIDATION_ERROR',
          message: nameValidation.error || 'Name must be 1-50 characters',
          field: 'name',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Get session
      const session = sessionService.getSession(sessionId);
      if (!session) {
        const errorResponse = {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or has expired',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Check for duplicate browser fingerprint (but allow reconnection)
      const existingParticipant = Array.from(session.participants.values()).find(
        (p) => p.browserFingerprint === browserFingerprint
      );

      // If already in session with same fingerprint, check if trying to join with different name
      if (existingParticipant && existingParticipant.name !== nameValidation.sanitized) {
        const errorResponse = {
          code: 'ALREADY_IN_SESSION',
          message: 'You are already in this session. Close other tabs or use a different browser.',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        if (callback) callback({ error: errorResponse });
        return;
      }

      // Try to join session
      let result;
      try {
        result = participantService.joinSession(session, {
          name: nameValidation.sanitized!,
          browserFingerprint,
          socketId: socket.id
        });
      } catch (error) {
        const errorMessage = (error as Error).message;

        // Check if it's a capacity error
        if (errorMessage.includes('full') || errorMessage.includes('20')) {
          const errorResponse = {
            code: 'SESSION_FULL',
            message: 'Session is full (maximum 20 participants)',
            timestamp: Date.now()
          };
          socket.emit('error', errorResponse);
          if (callback) callback({ error: errorResponse });
          return;
        }

        // Other errors
        throw error;
      }

      // Check if this is a reconnection (existing participant)
      const isReconnection = existingParticipant !== undefined;

      // Join the socket to the session room
      await socket.join(sessionId);

      // Store participant ID and session ID in socket data
      socket.data.participantId = result.participant.participantId;
      socket.data.sessionId = sessionId;

      // Emit join-accepted to the joining participant
      const joinAcceptedResponse = {
        participant: {
          participantId: result.participant.participantId,
          name: result.participant.name,
          emoji: result.participant.emoji,
          isModerator: result.participant.isModerator,
          joinTimestamp: result.participant.joinTimestamp,
          isConnected: true,
          hasVoted: result.participant.hasVoted,
          currentVote: result.participant.currentVote
        },
        session: {
          sessionId: result.session.sessionId,
          storyDescription: result.session.storyDescription,
          story: result.session.story,
          votingState: result.session.votingState,
          participantCount: result.session.participantCount
        },
        timestamp: Date.now()
      };

      socket.emit('join-accepted', joinAcceptedResponse);
      if (callback) callback(joinAcceptedResponse);

      // If this is a new participant (not a reconnection), broadcast to all others in the session
      if (!isReconnection) {
        const participantJoinedBroadcast = {
          participant: {
            participantId: result.participant.participantId,
            name: result.participant.name,
            emoji: result.participant.emoji,
            isModerator: result.participant.isModerator
          },
          participantCount: result.session.participantCount,
          timestamp: Date.now()
        };

        // Broadcast to all other participants in the session (excluding the joiner)
        socket.to(sessionId).emit('participant-joined', participantJoinedBroadcast);

        logWebSocketEvent('participant-joined', socket.id, {
          sessionId,
          participantId: result.participant.participantId,
          participantCount: result.session.participantCount
        });
      }

      logWebSocketEvent('join-accepted', socket.id, {
        sessionId,
        participantId: result.participant.participantId,
        isReconnection
      });

    } catch (error) {
      logError('Error joining session via WebSocket', error as Error, { socketId: socket.id });

      const errorResponse = {
        code: 'SERVER_ERROR',
        message: 'Failed to join session',
        timestamp: Date.now()
      };

      socket.emit('error', errorResponse);
      if (callback) callback({ error: errorResponse });
    }
  });
}

/**
 * Register all session-related event handlers
 */
export function registerSessionHandlers(socket: Socket) {
  handleCreateSession(socket);
  handleJoinSession(socket);
}
