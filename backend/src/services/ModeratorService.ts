import type { Session } from '../models/Session.js';
import type { Participant } from '../models/Participant.js';

/**
 * ModeratorService
 *
 * Handles moderator promotion (manual and automatic) operations.
 */
export class ModeratorService {
  /**
   * Manually promote a participant to moderator
   *
   * @param session - The session
   * @param promoterId - ID of the moderator performing the promotion
   * @param targetParticipantId - ID of the participant to promote
   * @returns The promoted participant
   */
  promoteModerator(
    session: Session,
    promoterId: string,
    targetParticipantId: string
  ): Participant {
    // Validate promoter is a moderator
    if (!session.moderatorIds.has(promoterId)) {
      throw new Error('Only moderators can promote others');
    }

    // Validate target participant exists
    const targetParticipant = session.participants.get(targetParticipantId);
    if (!targetParticipant) {
      throw new Error('Target participant not found');
    }

    // Check if already a moderator
    if (targetParticipant.isModerator) {
      throw new Error('Participant is already a moderator');
    }

    // Promote the participant
    targetParticipant.isModerator = true;
    session.moderatorIds.add(targetParticipantId);
    session.lastActivityAt = Date.now();

    return targetParticipant;
  }

  /**
   * Automatically promote the next participant to moderator (FIFO algorithm)
   * Called when the last moderator leaves the session
   *
   * @param session - The session
   * @param departedModeratorId - ID of the moderator who left
   * @returns The newly promoted participant, or null if no participants available
   */
  autoPromoteNextModerator(
    session: Session,
    departedModeratorId: string
  ): Participant | null {
    // Remove the departed moderator from moderator set
    session.moderatorIds.delete(departedModeratorId);

    // If other moderators remain, no auto-promotion needed
    if (session.moderatorIds.size > 0) {
      return null;
    }

    // Find next participant by join timestamp (FIFO - first in, first out)
    const connectedParticipants = Array.from(session.participants.values())
      .filter((p) => p.isConnected && p.participantId !== departedModeratorId)
      .sort((a, b) => a.joinTimestamp - b.joinTimestamp);

    // No participants left - session will naturally expire
    if (connectedParticipants.length === 0) {
      return null;
    }

    // Promote the first participant (earliest join time)
    const newModerator = connectedParticipants[0];
    newModerator.isModerator = true;
    session.moderatorIds.add(newModerator.participantId);
    session.lastActivityAt = Date.now();

    return newModerator;
  }

  /**
   * Check if a participant is a moderator
   *
   * @param session - The session
   * @param participantId - ID of the participant to check
   * @returns True if the participant is a moderator
   */
  isModerator(session: Session, participantId: string): boolean {
    return session.moderatorIds.has(participantId);
  }

  /**
   * Get all moderators in a session
   *
   * @param session - The session
   * @returns Array of moderator participants
   */
  getModerators(session: Session): Participant[] {
    const moderators: Participant[] = [];

    session.moderatorIds.forEach((moderatorId) => {
      const participant = session.participants.get(moderatorId);
      if (participant) {
        moderators.push(participant);
      }
    });

    return moderators;
  }
}
