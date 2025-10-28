import { Socket } from 'socket.io';
import { sessionService } from '../../services/SessionService.js';
import { ModeratorService } from '../../services/ModeratorService.js';
import { ERROR_CODES } from '../../config/constants.js';
import { logWebSocketEvent, logError } from '../../utils/logger.js';

const moderatorService = new ModeratorService();

/**
 * WebSocket Moderator Handlers
 *
 * Implements WebSocket event handlers for moderator operations as defined in:
 * specs/001-anonymous-planning-poker/contracts/websocket-events.md
 */

/**
 * Handle promote-moderator event
 *
 * Allows existing moderators to manually promote other participants to moderator status.
 * Broadcasts moderator-promoted event to all participants.
 */
export function handlePromoteModerator(socket: Socket) {
  socket.on('promote-moderator', async (data) => {
    try {
      logWebSocketEvent('promote-moderator', socket.id, data);

      const { sessionId, promoterId, targetParticipantId } = data;

      // Validate required fields
      if (!sessionId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Session ID is required',
          field: 'sessionId',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (!promoterId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Promoter ID is required',
          field: 'promoterId',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (!targetParticipantId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Target participant ID is required',
          field: 'targetParticipantId',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Get session
      const session = sessionService.getSession(sessionId);
      if (!session) {
        const errorResponse = {
          code: ERROR_CODES.SESSION_NOT_FOUND,
          message: 'Session not found or has expired',
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Promote the participant using ModeratorService
      try {
        const promotedParticipant = moderatorService.promoteModerator(
          session,
          promoterId,
          targetParticipantId
        );

        // Broadcast moderator-promoted to all participants in session
        const promotionEvent = {
          participantId: promotedParticipant.participantId,
          participantName: promotedParticipant.name,
          participantEmoji: promotedParticipant.emoji,
          promotionType: 'manual' as const,
          timestamp: Date.now()
        };

        socket.to(sessionId).emit('moderator-promoted', promotionEvent);
        socket.emit('moderator-promoted', promotionEvent);

        logWebSocketEvent('moderator-promoted', sessionId, promotionEvent);

      } catch (error) {
        // Handle specific errors from ModeratorService
        const errorMessage = error instanceof Error ? error.message : 'Failed to promote moderator';

        let errorCode = ERROR_CODES.SERVER_ERROR;
        if (errorMessage.includes('Only moderators')) {
          errorCode = 'NOT_MODERATOR';
        } else if (errorMessage.includes('not found')) {
          errorCode = ERROR_CODES.PARTICIPANT_NOT_FOUND;
        } else if (errorMessage.includes('already a moderator')) {
          errorCode = 'ALREADY_MODERATOR';
        }

        const errorResponse = {
          code: errorCode,
          message: errorMessage,
          timestamp: Date.now()
        };
        socket.emit('error', errorResponse);
        logError('Error promoting moderator', error, { socketId: socket.id, data });
      }

    } catch (error) {
      logError('Error in promote-moderator handler', error, { socketId: socket.id, data });
      const errorResponse = {
        code: ERROR_CODES.SERVER_ERROR,
        message: 'Internal server error',
        timestamp: Date.now()
      };
      socket.emit('error', errorResponse);
    }
  });
}

/**
 * Broadcast auto-promotion event to all participants
 *
 * Called when a moderator disconnects and auto-promotion occurs.
 *
 * @param io - Socket.io server instance
 * @param sessionId - Session ID to broadcast to
 * @param promotedParticipant - The participant who was auto-promoted
 */
export function broadcastAutoPromotion(
  io: any,
  sessionId: string,
  promotedParticipant: { participantId: string; name: string; emoji: string }
) {
  const promotionEvent = {
    participantId: promotedParticipant.participantId,
    participantName: promotedParticipant.name,
    participantEmoji: promotedParticipant.emoji,
    promotionType: 'auto' as const,
    timestamp: Date.now()
  };

  io.to(sessionId).emit('moderator-promoted', promotionEvent);
  logWebSocketEvent('moderator-promoted', sessionId, { ...promotionEvent, type: 'auto' });
}

/**
 * Register all moderator-related event handlers for a socket
 */
export function registerModeratorHandlers(socket: Socket) {
  handlePromoteModerator(socket);
}

export { moderatorService };
