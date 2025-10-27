import type { CardValue } from '../config/constants.js';

/**
 * Vote entity - represents a vote cast by a participant
 */
export interface Vote {
  /** Participant ID who cast the vote */
  participantId: string;

  /** Snapshot of participant name at vote time */
  participantName: string;

  /** Snapshot of participant emoji at vote time */
  participantEmoji: string;

  /** The card value selected */
  cardValue: CardValue;

  /** Unix timestamp (ms) when vote was cast */
  votedAt: number;

  /** Whether votes have been revealed */
  revealed: boolean;
}

/**
 * VoteRound entity - represents a completed voting round
 */
export interface VoteRound {
  /** Sequential round number */
  roundNumber: number;

  /** Unix timestamp (ms) when round completed */
  completedAt: number;

  /** Story description for this round */
  storyDescription: string;

  /** All votes from this round */
  votes: Vote[];

  /** Whether all votes were identical */
  consensus: boolean;

  /** Average of numeric votes (excludes '?') */
  averageVote: number | null;
}

/**
 * Cast vote parameters
 */
export interface CastVoteParams {
  sessionId: string;
  participantId: string;
  cardValue: CardValue;
}

/**
 * Vote statistics (computed on-demand)
 */
export interface VoteStatistics {
  /** Total votes cast */
  totalVotes: number;

  /** Total active participants */
  totalParticipants: number;

  /** Distribution of votes (card value → count) */
  voteDistribution: Map<CardValue, number>;

  /** Whether all votes are identical */
  consensus: boolean;

  /** Average of numeric votes (excludes '?') */
  averageNumeric: number | null;

  /** Median of numeric votes (excludes '?') */
  medianNumeric: number | null;
}

/**
 * Revealed votes data for client
 */
export interface RevealedVotesData {
  votes: Vote[];
  statistics: {
    totalVotes: number;
    totalParticipants: number;
    consensus: boolean;
    averageNumeric: number | null;
    medianNumeric: number | null;
    voteDistribution: Record<string, number>;
  };
}
