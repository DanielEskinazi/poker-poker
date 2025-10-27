import type { CardValue } from '../config/constants.js';

/**
 * Participant entity - represents a person in a session
 */
export interface Participant {
  /** Unique participant identifier (nanoid 16 chars) */
  participantId: string;

  /** Browser/device fingerprint for duplicate detection */
  browserFingerprint: string;

  /** User-provided name (1-50 characters) */
  name: string;

  /** Assigned emoji avatar */
  emoji: string;

  /** Whether participant has moderator privileges */
  isModerator: boolean;

  /** Unix timestamp (ms) when participant joined */
  joinTimestamp: number;

  /** Whether participant is currently connected */
  isConnected: boolean;

  /** Set of Socket.io connection IDs (for multi-tab support) */
  socketIds: Set<string>;

  /** Unix timestamp (ms) of last seen activity */
  lastSeenAt: number;

  /** Whether participant has voted in current round */
  hasVoted: boolean;

  /** Current vote value (hidden until reveal) */
  currentVote: CardValue | null;
}

/**
 * Join session parameters
 */
export interface JoinSessionParams {
  sessionId: string;
  name: string;
  browserFingerprint: string;
  socketId: string;
}

/**
 * Join session result
 */
export interface JoinSessionResult {
  participant: Participant;
  session: {
    sessionId: string;
    storyDescription: string;
    votingState: string;
    participantCount: number;
  };
}

/**
 * Participant data for client (excludes sensitive fields)
 */
export interface ParticipantPublicData {
  participantId: string;
  name: string;
  emoji: string;
  isModerator: boolean;
  isConnected: boolean;
  hasVoted: boolean;
}

/**
 * Convert participant to public data
 */
export function toPublicData(participant: Participant): ParticipantPublicData {
  return {
    participantId: participant.participantId,
    name: participant.name,
    emoji: participant.emoji,
    isModerator: participant.isModerator,
    isConnected: participant.isConnected,
    hasVoted: participant.hasVoted,
  };
}
