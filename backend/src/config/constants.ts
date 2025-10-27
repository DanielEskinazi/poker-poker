/**
 * Application Constants
 *
 * Defines constant values used throughout the Planning Poker application.
 */

export type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';

/**
 * Fibonacci card deck used for voting
 * Per FR-007: 1, 2, 3, 5, 8, 13, 21, and '?' (for uncertainty)
 */
export const CARD_DECK: readonly CardValue[] = [1, 2, 3, 5, 8, 13, 21, '?'] as const;

/**
 * Maximum number of participants per session
 * Per FR-031: Hard limit of 20 participants
 */
export const MAX_PARTICIPANTS = 20;

/**
 * Session expiry time in milliseconds
 * Default: 1 hour (3,600,000 ms)
 * Per SC-011: Sessions expire after 1 hour of inactivity
 */
export const SESSION_EXPIRY_MS = 3_600_000;

/**
 * Grace period before removing disconnected participant (ms)
 * Default: 30 seconds
 */
export const DISCONNECT_GRACE_PERIOD_MS = 30_000;

/**
 * Session expiry warning threshold (ms before expiry)
 * Default: 5 minutes (300,000 ms)
 */
export const EXPIRY_WARNING_THRESHOLD_MS = 300_000;

/**
 * Cleanup job interval (ms)
 * How often to check for expired sessions
 * Default: 5 minutes
 */
export const CLEANUP_INTERVAL_MS = 300_000;

/**
 * Emoji avatars for participants
 * Used for visual differentiation when multiple participants have similar names
 * Hash-based assignment ensures deterministic emoji per participantId
 */
export const EMOJI_AVATARS: readonly string[] = [
  '🎯', '🚀', '⚡', '🌟', '🎨', '🔥', '💎', '🌈', '🎭', '🎪',
  '🎸', '🎺', '🎻', '🎹', '🥁', '🎬', '🎮', '🎲', '🎳', '🎯',
  '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️',
  '🌺', '🌸', '🌼', '🌻', '🌷', '🌹', '🥀', '🌾', '🌿', '🍀',
  '🍁', '🍂', '🍃', '🌍', '🌎', '🌏', '🌐', '🗺️', '🧭', '⛰️',
  '🌋', '🗻', '🏔️', '⛺', '🏕️', '🏖️', '🏝️', '🏜️', '🏞️', '🏟️'
] as const;

/**
 * Valid voting states for a session
 */
export type VotingState = 'voting' | 'revealed';

/**
 * WebSocket event names
 */
export const SOCKET_EVENTS = {
  // Client → Server
  CREATE_SESSION: 'create-session',
  JOIN_SESSION: 'join-session',
  CAST_VOTE: 'cast-vote',
  REVEAL_VOTES: 'reveal-votes',
  RESET_VOTES: 'reset-votes',
  PROMOTE_MODERATOR: 'promote-moderator',

  // Server → Client
  SESSION_CREATED: 'session-created',
  JOIN_ACCEPTED: 'join-accepted',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  VOTE_ACCEPTED: 'vote-accepted',
  VOTE_COUNT_UPDATED: 'vote-count-updated',
  VOTES_REVEALED: 'votes-revealed',
  VOTES_RESET: 'votes-reset',
  MODERATOR_PROMOTED: 'moderator-promoted',
  SESSION_EXPIRING: 'session-expiring',
  SESSION_EXPIRED: 'session-expired',
  RECONNECTION_SUCCESSFUL: 'reconnection-successful',
  ERROR: 'error',
} as const;

/**
 * Error codes for standardized error handling
 */
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SESSION_ID: 'INVALID_SESSION_ID',
  INVALID_CARD_VALUE: 'INVALID_CARD_VALUE',
  
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_FULL: 'SESSION_FULL',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Participant errors
  PARTICIPANT_NOT_FOUND: 'PARTICIPANT_NOT_FOUND',
  ALREADY_IN_SESSION: 'ALREADY_IN_SESSION',
  
  // Authorization errors
  NOT_AUTHORIZED: 'NOT_AUTHORIZED',
  MODERATOR_ONLY: 'MODERATOR_ONLY',
  
  // Voting errors
  VOTES_ALREADY_REVEALED: 'VOTES_ALREADY_REVEALED',
  NO_VOTES_TO_REVEAL: 'NO_VOTES_TO_REVEAL',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;
