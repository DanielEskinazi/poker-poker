/**
 * Shared type definitions for Participant
 * Used by both backend and frontend
 */

import type { CardValue } from './Common.js';

/**
 * Participant data for client (excludes sensitive fields like browserFingerprint)
 */
export interface Participant {
  participantId: string;
  name: string;
  emoji: string;
  isModerator: boolean;
  isConnected: boolean;
  hasVoted: boolean;
  joinTimestamp: number;
}

/**
 * Participant with vote data (only sent after reveal)
 */
export interface ParticipantWithVote extends Participant {
  currentVote: CardValue | null;
}
