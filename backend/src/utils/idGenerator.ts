import { nanoid } from 'nanoid';

/**
 * Generate a unique session ID (8 alphanumeric characters)
 */
export function generateSessionId(): string {
  return nanoid(8);
}

/**
 * Generate a unique participant ID (16 characters)
 */
export function generateParticipantId(): string {
  return nanoid(16);
}

/**
 * Validate session ID format
 */
export function isValidSessionId(sessionId: string): boolean {
  return /^[A-Za-z0-9]{8}$/.test(sessionId);
}

/**
 * Validate participant ID format
 */
export function isValidParticipantId(participantId: string): boolean {
  return /^[A-Za-z0-9_-]{16,}$/.test(participantId);
}
