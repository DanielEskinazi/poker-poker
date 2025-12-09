import { Socket } from 'socket.io';
import { sessionService } from '../../services/SessionService.js';
import { votingService } from '../../services/VotingService.js';
import { isValidCardValue, ERROR_CODES } from '../../config/constants.js';
import { logWebSocketEvent, logError } from '../../utils/logger.js';
import type { CardValue } from '../../config/constants.js';

/**
 * WebSocket Voting Handlers
 *
 * Implements WebSocket event handlers for voting operations as defined in:
 * specs/001-anonymous-planning-poker/contracts/websocket-events.md
 */

/**
 * Handle cast-vote event
 *
 * Allows participants to cast or change their vote during the voting phase.
 * Broadcasts vote count (without values) to all participants for real-time feedback.
 */
export function handleCastVote(socket: Socket) {
  socket.on('cast-vote', async (data) => {
    try {
      logWebSocketEvent('cast-vote', socket.id, data);

      const { sessionId, participantId, cardValue } = data;

      // Validate required fields
      if (!sessionId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Session ID is required',
          field: 'sessionId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (!participantId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Participant ID is required',
          field: 'participantId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (cardValue === undefined || cardValue === null) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Card value is required',
          field: 'cardValue'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Validate card value
      if (!isValidCardValue(cardValue)) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: `Invalid card value. Must be one of: 1, 2, 3, 5, 8, 13, 21, or '?'`,
          field: 'cardValue'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Get session
      const session = sessionService.getSession(sessionId);
      if (!session) {
        const errorResponse = {
          code: ERROR_CODES.SESSION_NOT_FOUND,
          message: 'Session not found or has expired'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Validate participant exists
      const participant = session.participants.get(participantId);
      if (!participant) {
        const errorResponse = {
          code: ERROR_CODES.PARTICIPANT_NOT_FOUND,
          message: 'Participant not found in this session'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Check if votes already revealed
      if (session.votingState === 'revealed') {
        const errorResponse = {
          code: 'ALREADY_REVEALED',
          message: 'Votes already revealed. Reset votes to start a new round.'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Cast the vote using VotingService
      votingService.castVote(session, {
        participantId,
        cardValue: cardValue as CardValue
      });

      // Send vote-accepted confirmation to the voter
      socket.emit('vote-accepted', {
        cardValue,
        timestamp: Date.now()
      });

      logWebSocketEvent('vote-accepted', socket.id, { cardValue });

      // Build hasVoted map for all participants
      const hasVoted: Record<string, boolean> = {};
      session.participants.forEach((p, pid) => {
        hasVoted[pid] = p.hasVoted;
      });

      // Get voter count (excluding spectators)
      const voteCount = votingService.getVoteCount(session);

      // Broadcast vote-count-updated to all participants in session
      // IMPORTANT: Do NOT include vote values - only counts (preserves privacy)
      const voteCountUpdate = {
        votedCount: voteCount.voted,
        totalParticipants: voteCount.total,
        hasVoted,
        timestamp: Date.now()
      };

      socket.to(sessionId).emit('vote-count-updated', voteCountUpdate);
      socket.emit('vote-count-updated', voteCountUpdate);

      logWebSocketEvent('vote-count-updated', sessionId, voteCountUpdate);

    } catch (error) {
      logError('Error in cast-vote handler', error, { socketId: socket.id, data });
      const errorResponse = {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to cast vote'
      };
      socket.emit('error', errorResponse);
    }
  });
}

/**
 * Handle reveal-votes event (Moderator only)
 *
 * Reveals all votes to all participants and broadcasts the results including statistics.
 */
export function handleRevealVotes(socket: Socket) {
  socket.on('reveal-votes', async (data) => {
    try {
      logWebSocketEvent('reveal-votes', socket.id, data);

      const { sessionId, moderatorId } = data;

      // Validate required fields
      if (!sessionId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Session ID is required',
          field: 'sessionId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (!moderatorId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Moderator ID is required',
          field: 'moderatorId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Get session
      const session = sessionService.getSession(sessionId);
      if (!session) {
        const errorResponse = {
          code: ERROR_CODES.SESSION_NOT_FOUND,
          message: 'Session not found or has expired'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Validate moderator authorization
      if (!session.moderatorIds.has(moderatorId)) {
        const errorResponse = {
          code: 'NOT_MODERATOR',
          message: 'Only moderators can reveal votes'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Check if there are votes to reveal
      if (session.votes.size === 0) {
        const errorResponse = {
          code: 'NO_VOTES',
          message: 'No votes to reveal'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Check if already revealed
      if (session.votingState === 'revealed') {
        const errorResponse = {
          code: 'ALREADY_REVEALED',
          message: 'Votes have already been revealed'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Reveal votes using VotingService
      const revealedData = votingService.revealVotes(session, moderatorId);

      // Broadcast votes-revealed to all participants
      const revealPayload = {
        votes: revealedData.votes.map(vote => ({
          participantId: vote.participantId,
          participantName: vote.participantName,
          participantEmoji: vote.participantEmoji,
          cardValue: vote.cardValue
        })),
        statistics: {
          consensus: revealedData.statistics.consensus,
          averageNumeric: revealedData.statistics.averageNumeric,
          distribution: revealedData.statistics.voteDistribution
        },
        timestamp: Date.now()
      };

      socket.to(sessionId).emit('votes-revealed', revealPayload);
      socket.emit('votes-revealed', revealPayload);

      logWebSocketEvent('votes-revealed', sessionId, {
        voteCount: revealedData.votes.length,
        consensus: revealedData.statistics.consensus
      });

    } catch (error) {
      logError('Error in reveal-votes handler', error, { socketId: socket.id, data });
      const errorResponse = {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to reveal votes'
      };
      socket.emit('error', errorResponse);
    }
  });
}

/**
 * Handle reset-votes event (Moderator only)
 *
 * Resets all votes for a new voting round. Archives current round to history.
 */
export function handleResetVotes(socket: Socket) {
  socket.on('reset-votes', async (data) => {
    try {
      logWebSocketEvent('reset-votes', socket.id, data);

      const { sessionId, moderatorId } = data;

      // Validate required fields
      if (!sessionId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Session ID is required',
          field: 'sessionId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      if (!moderatorId) {
        const errorResponse = {
          code: ERROR_CODES.VALIDATION_ERROR,
          message: 'Moderator ID is required',
          field: 'moderatorId'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Get session
      const session = sessionService.getSession(sessionId);
      if (!session) {
        const errorResponse = {
          code: ERROR_CODES.SESSION_NOT_FOUND,
          message: 'Session not found or has expired'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Validate moderator authorization
      if (!session.moderatorIds.has(moderatorId)) {
        const errorResponse = {
          code: 'NOT_MODERATOR',
          message: 'Only moderators can reset votes'
        };
        socket.emit('error', errorResponse);
        return;
      }

      // Reset votes using VotingService
      votingService.resetVotes(session, moderatorId);

      // Broadcast votes-reset to all participants
      const resetPayload = {
        timestamp: Date.now()
      };

      socket.to(sessionId).emit('votes-reset', resetPayload);
      socket.emit('votes-reset', resetPayload);

      logWebSocketEvent('votes-reset', sessionId, resetPayload);

    } catch (error) {
      logError('Error in reset-votes handler', error, { socketId: socket.id, data });
      const errorResponse = {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error instanceof Error ? error.message : 'Failed to reset votes'
      };
      socket.emit('error', errorResponse);
    }
  });
}

/**
 * Register all voting handlers for a socket connection
 */
export function registerVotingHandlers(socket: Socket) {
  handleCastVote(socket);
  handleRevealVotes(socket);
  handleResetVotes(socket);
}
