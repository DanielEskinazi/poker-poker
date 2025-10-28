import { Socket } from 'socket.io';
import { sessionService } from '../../services/SessionService.js';
import { participantService } from '../../services/ParticipantService.js';
import { logWebSocketEvent, logError } from '../../utils/logger.js';

/**
 * WebSocket Connection Handlers
 *
 * Handles connection lifecycle events including:
 * - Disconnection with grace period
 * - Participant removal after grace period
 * - Auto-promotion of moderators on disconnect
 */

// Track disconnect timers for grace period
const disconnectTimers = new Map<string, NodeJS.Timeout>();

// Grace period before removing participant (30 seconds)
const DISCONNECT_GRACE_PERIOD_MS = 30000;

/**
 * Handle participant disconnect
 *
 * Implements 30-second grace period before removing participant from session.
 * If participant reconnects within grace period, they rejoin without being removed.
 */
export function handleDisconnect(socket: Socket, io: any) {
  socket.on('disconnect', (reason) => {
    logWebSocketEvent('client disconnected', socket.id, { reason });

    // Get participant info from socket data (set during join)
    const participantId = socket.data.participantId;
    const sessionId = socket.data.sessionId;

    if (!participantId || !sessionId) {
      // Socket was never properly joined to a session
      return;
    }

    const session = sessionService.getSession(sessionId);
    if (!session) {
      return;
    }

    const participant = session.participants.get(participantId);
    if (!participant) {
      return;
    }

    // Mark participant as disconnected
    participant.socketIds.delete(socket.id);
    if (participant.socketIds.size === 0) {
      participant.isConnected = false;
    }

    logWebSocketEvent('participant-disconnected', socket.id, {
      sessionId,
      participantId,
      participantName: participant.name,
      gracePeriod: `${DISCONNECT_GRACE_PERIOD_MS / 1000}s`,
    });

    // Broadcast connection status update immediately
    io.to(sessionId).emit('participant-status-changed', {
      participantId,
      isConnected: false,
      timestamp: Date.now(),
    });

    // Clear any existing timer for this participant
    const existingTimer = disconnectTimers.get(participantId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set timer for grace period
    const timer = setTimeout(() => {
      // Double-check participant still exists and is still disconnected
      const currentSession = sessionService.getSession(sessionId);
      if (!currentSession) {
        return;
      }

      const currentParticipant = currentSession.participants.get(participantId);
      if (!currentParticipant) {
        return;
      }

      // If participant reconnected during grace period, don't remove
      if (currentParticipant.isConnected) {
        logWebSocketEvent('participant-reconnected-within-grace-period', participantId, {
          sessionId,
          participantName: currentParticipant.name,
        });
        disconnectTimers.delete(participantId);
        return;
      }

      // Remove participant from session
      logWebSocketEvent('removing-participant-after-grace-period', participantId, {
        sessionId,
        participantName: currentParticipant.name,
      });

      // Check if participant was a moderator
      const wasModerator = currentSession.moderatorIds.has(participantId);

      // Remove participant
      participantService.removeParticipant(currentSession, participantId);

      // Broadcast participant-left event
      io.to(sessionId).emit('participant-left', {
        participant: {
          participantId,
          name: currentParticipant.name,
          emoji: currentParticipant.emoji,
        },
        reason: 'disconnect-timeout',
        timestamp: Date.now(),
      });

      // If removed participant was the last moderator, auto-promote next participant
      if (wasModerator && currentSession.moderatorIds.size === 0 && currentSession.participants.size > 0) {
        // Get next participant (FIFO - first joined)
        const nextParticipant = Array.from(currentSession.participants.values())[0];

        // Promote to moderator
        currentSession.moderatorIds.add(nextParticipant.participantId);

        logWebSocketEvent('auto-promote-moderator', nextParticipant.participantId, {
          sessionId,
          participantName: nextParticipant.name,
          reason: 'last-moderator-disconnected',
        });

        // Broadcast moderator-promoted event
        io.to(sessionId).emit('moderator-promoted', {
          participant: {
            participantId: nextParticipant.participantId,
            name: nextParticipant.name,
            emoji: nextParticipant.emoji,
          },
          reason: 'auto-succession',
          timestamp: Date.now(),
        });
      }

      // Clean up timer
      disconnectTimers.delete(participantId);
    }, DISCONNECT_GRACE_PERIOD_MS);

    // Store timer
    disconnectTimers.set(participantId, timer);
  });
}

/**
 * Handle reconnection within grace period
 *
 * If a participant reconnects with the same fingerprint before the grace period expires,
 * they rejoin with the same participant ID and state.
 */
export function handleReconnection(socket: Socket, participantId: string, sessionId: string) {
  const session = sessionService.getSession(sessionId);
  if (!session) {
    return false;
  }

  const participant = session.participants.get(participantId);
  if (!participant) {
    return false;
  }

  // Cancel disconnect timer if exists
  const timer = disconnectTimers.get(participantId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(participantId);

    logWebSocketEvent('cancelled-disconnect-timer', participantId, {
      sessionId,
      participantName: participant.name,
    });
  }

  // Update participant connection status
  participant.isConnected = true;
  participant.socketIds.add(socket.id);

  // Store participant and session info in socket for disconnect handler
  socket.data.participantId = participantId;
  socket.data.sessionId = sessionId;

  logWebSocketEvent('participant-reconnected', participantId, {
    sessionId,
    participantName: participant.name,
  });

  return true;
}

/**
 * Register connection handlers for a socket
 */
export function registerConnectionHandlers(socket: Socket, io: any) {
  handleDisconnect(socket, io);
}

/**
 * Store participant info in socket for disconnect tracking
 */
export function storeParticipantSocketInfo(socket: Socket, participantId: string, sessionId: string) {
  socket.data.participantId = participantId;
  socket.data.sessionId = sessionId;
}
