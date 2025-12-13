/**
 * WebSocket event payload types
 * Used by both backend and frontend
 */

import type { CardValue } from './Common.js';
import type { Participant } from './Participant.js';
import type { Vote, VoteStatistics } from './Vote.js';
import type { SessionMetadata } from './Session.js';

// ===== Client → Server Events =====

export interface CreateSessionPayload {
  name: string;
  browserFingerprint: string;
}

export interface JoinSessionPayload {
  sessionId: string;
  name: string;
  browserFingerprint: string;
}

export interface CastVotePayload {
  sessionId: string;
  participantId: string;
  cardValue: CardValue;
}

export interface RevealVotesPayload {
  sessionId: string;
  moderatorId: string;
}

export interface ResetVotesPayload {
  sessionId: string;
  moderatorId: string;
}

export interface PromoteModeratorPayload {
  sessionId: string;
  promoterId: string;
  targetParticipantId: string;
}

// ===== Server → Client Events =====

export interface SessionCreatedPayload {
  sessionId: string;
  participantId: string;
  session: SessionMetadata;
  participant: Participant;
}

export interface JoinAcceptedPayload {
  sessionId: string;
  participantId: string;
  session: SessionMetadata;
  participant: Participant;
  participants: Participant[];
}

export interface ParticipantJoinedPayload {
  sessionId: string;
  participant: Participant;
}

export interface ParticipantLeftPayload {
  sessionId: string;
  participantId: string;
}

export interface VoteAcceptedPayload {
  sessionId: string;
  participantId: string;
}

export interface VoteCountUpdatedPayload {
  sessionId: string;
  voted: number;
  total: number;
}

export interface VotesRevealedPayload {
  sessionId: string;
  votes: Vote[];
  statistics: VoteStatistics;
}

export interface VotesResetPayload {
  sessionId: string;
}

export interface ModeratorPromotedPayload {
  sessionId: string;
  participantId: string;
  promotedBy: string;
}

export interface SessionExpiringPayload {
  sessionId: string;
  expiresIn: number; // milliseconds
}

export interface SessionExpiredPayload {
  sessionId: string;
  message: string;
}

export interface ReconnectionSuccessfulPayload {
  sessionId: string;
  participantId: string;
  session: SessionMetadata;
  participants: Participant[];
  voteCount: {
    voted: number;
    total: number;
  };
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
