/**
 * Shared type definitions for Session
 * Used by both backend and frontend
 */

import type { Participant } from './Participant.js';
import type { Vote, VoteRound } from './Vote.js';
import type { StoryDetails } from './Story.js';

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
  /** @deprecated Use story.description for backward compatibility display */
  storyDescription: string;
  story: StoryDetails;
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
  /** @deprecated Use story.description for backward compatibility display */
  storyDescription: string;
  story: StoryDetails;
  votingState: VotingState;
  participants: Participant[];
  votes: Vote[];
  voteHistory: VoteRound[];
  participantCount: number;
  moderatorIds: string[];
}
