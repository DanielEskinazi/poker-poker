import type { Participant } from './Participant.js';
import type { Vote, VoteRound } from './Vote.js';

/**
 * Voting state of a session
 */
export type VotingState = 'voting' | 'revealed';

/**
 * Session entity - represents an active Planning Poker estimation session
 */
export interface Session {
  /** Unique session identifier (8-character alphanumeric) */
  sessionId: string;

  /** Unix timestamp (ms) when session was created */
  createdAt: number;

  /** Unix timestamp (ms) of last activity (updated on any action) */
  lastActivityAt: number;

  /** Unix timestamp (ms) when session expires (createdAt + 1 hour) */
  expiresAt: number;

  /** Story description being estimated */
  storyDescription: string;

  /** Current voting phase */
  votingState: VotingState;

  /** Map of participants (key: participantId) */
  participants: Map<string, Participant>;

  /** Current round votes (key: participantId) */
  votes: Map<string, Vote>;

  /** Historical voting rounds */
  voteHistory: VoteRound[];

  /** Current participant count */
  participantCount: number;

  /** Set of participant IDs with moderator privileges */
  moderatorIds: Set<string>;
}

/**
 * Session creation parameters
 */
export interface CreateSessionParams {
  creatorName: string;
  browserFingerprint: string;
}

/**
 * Session creation result
 */
export interface CreateSessionResult {
  session: Session;
  participant: Participant;
}

/**
 * Session metadata (for REST API responses)
 */
export interface SessionMetadata {
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  storyDescription: string;
  votingState: VotingState;
  participantCount: number;
}
