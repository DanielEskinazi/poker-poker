import { generateParticipantId } from '../utils/idGenerator.js';
import { assignEmojiByHash } from '../utils/emojiAssigner.js';
import { env } from '../config/environment.js';
import type { Participant, JoinSessionParams, JoinSessionResult } from '../models/Participant.js';
import type { Session } from '../models/Session.js';

/**
 * ParticipantService
 *
 * Handles participant joining, leaving, and state management within sessions.
 */
export class ParticipantService {
  /**
   * Add a participant to a session
   */
  joinSession(session: Session, params: JoinSessionParams): JoinSessionResult {
    // Check capacity (FR-031)
    if (session.participantCount >= env.MAX_PARTICIPANTS) {
      throw new Error('Session is full (maximum 20 participants)');
    }

    // Check for duplicate browser fingerprint (FR-028, FR-030)
    const existingParticipant = Array.from(session.participants.values()).find(
      (p) => p.browserFingerprint === params.browserFingerprint
    );

    if (existingParticipant) {
      // Reconnect existing participant
      existingParticipant.isConnected = true;
      existingParticipant.lastSeenAt = Date.now();
      existingParticipant.socketIds.add(params.socketId);

      return {
        participant: existingParticipant,
        session: {
          sessionId: session.sessionId,
          storyDescription: session.storyDescription,
          votingState: session.votingState,
          participantCount: session.participantCount,
        },
      };
    }

    // Create new participant
    const participantId = generateParticipantId();
    const emoji = assignEmojiByHash(participantId);

    const participant: Participant = {
      participantId,
      browserFingerprint: params.browserFingerprint,
      name: params.name,
      emoji,
      isModerator: false,
      joinTimestamp: Date.now(),
      isConnected: true,
      socketIds: new Set([params.socketId]),
      lastSeenAt: Date.now(),
      hasVoted: false,
      currentVote: null,
    };

    // Add to session
    session.participants.set(participantId, participant);
    session.participantCount++;
    session.lastActivityAt = Date.now();

    return {
      participant,
      session: {
        sessionId: session.sessionId,
        storyDescription: session.storyDescription,
        votingState: session.votingState,
        participantCount: session.participantCount,
      },
    };
  }

  /**
   * Remove a participant from a session
   */
  removeParticipant(session: Session, participantId: string): boolean {
    const participant = session.participants.get(participantId);
    if (!participant) {
      return false;
    }

    // Remove from session
    session.participants.delete(participantId);
    session.participantCount--;
    session.moderatorIds.delete(participantId);

    // Remove their vote if present
    session.votes.delete(participantId);

    return true;
  }

  /**
   * Mark participant as disconnected
   */
  markDisconnected(session: Session, participantId: string, socketId: string): void {
    const participant = session.participants.get(participantId);
    if (participant) {
      participant.socketIds.delete(socketId);
      if (participant.socketIds.size === 0) {
        participant.isConnected = false;
      }
    }
  }

  /**
   * Get all participants in a session
   */
  getAllParticipants(session: Session): Participant[] {
    return Array.from(session.participants.values());
  }

  /**
   * Get participant by ID
   */
  getParticipant(session: Session, participantId: string): Participant | undefined {
    return session.participants.get(participantId);
  }
}

// Export singleton instance
export const participantService = new ParticipantService();
