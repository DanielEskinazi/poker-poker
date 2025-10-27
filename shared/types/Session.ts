/**
 * Shared type definitions for Session
 * Used by both backend and frontend
 */

import type { Participant } from './Participant.js';
import type { Vote, VoteRound } from './Vote.js';

/**
 * Voting state of a session
 */
export type VotingState = 'voting' | 'revealed';

/**
 * Session metadata (for REST API responses and WebSocket events)
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

/**
 * Session data for frontend (serialized version)
 */
export interface SessionData {
  sessionId: string;
  createdAt: number;
  lastActivityAt: number;
  expiresAt: number;
  storyDescription: string;
  votingState: VotingState;
  participants: Participant[];
  votes: Vote[];
  voteHistory: VoteRound[];
  participantCount: number;
  moderatorIds: string[];
}
