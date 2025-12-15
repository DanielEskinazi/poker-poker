/**
 * Shared type definitions for Vote
 * Used by both backend and frontend
 */

import type { CardValue } from './Common.js';
import type { StoryDetails } from './Story.js';

/**
 * Vote data
 */
export interface Vote {
  participantId: string;
  participantName: string;
  participantEmoji: string;
  cardValue: CardValue;
  votedAt: number;
  revealed: boolean;
}

/**
 * VoteRound - historical voting round
 */
export interface VoteRound {
  roundNumber: number;
  completedAt: number;
  /** @deprecated Use story for full details */
  storyDescription: string;
  story: StoryDetails;
  votes: Vote[];
  consensus: boolean;
  averageVote: number | null;
}

/**
 * Vote statistics
 */
export interface VoteStatistics {
  totalVotes: number;
  totalParticipants: number;
  consensus: boolean;
  averageNumeric: number | null;
  medianNumeric: number | null;
  voteDistribution: Record<string, number>;
}
