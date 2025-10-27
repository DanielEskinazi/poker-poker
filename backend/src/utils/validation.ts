import DOMPurify from 'isomorphic-dompurify';
import { isValidCardValue, type CardValue } from '../config/constants.js';

/**
 * Sanitize user input to prevent XSS attacks
 */
export function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

/**
 * Validate and sanitize participant name
 */
export function validateName(name: unknown): {
  valid: boolean;
  sanitized?: string;
  error?: string;
} {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less' };
  }

  const sanitized = sanitizeInput(trimmed);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, sanitized };
}

/**
 * Validate card value
 */
export function validateCardValue(value: unknown): {
  valid: boolean;
  cardValue?: CardValue;
  error?: string;
} {
  if (!isValidCardValue(value)) {
    return {
      valid: false,
      error: `Invalid card value. Must be one of: 1, 2, 3, 5, 8, 13, 21, '?'`,
    };
  }

  return { valid: true, cardValue: value };
}

/**
 * Validate browser fingerprint
 */
export function validateBrowserFingerprint(fingerprint: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof fingerprint !== 'string') {
    return { valid: false, error: 'Browser fingerprint must be a string' };
  }

  if (fingerprint.length === 0) {
    return { valid: false, error: 'Browser fingerprint cannot be empty' };
  }

  if (fingerprint.length > 200) {
    return { valid: false, error: 'Browser fingerprint is too long' };
  }

  return { valid: true };
}

/**
 * Validate session ID format
 */
export function validateSessionIdFormat(sessionId: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof sessionId !== 'string') {
    return { valid: false, error: 'Session ID must be a string' };
  }

  if (!/^[A-Za-z0-9]{8}$/.test(sessionId)) {
    return {
      valid: false,
      error: 'Session ID must be exactly 8 alphanumeric characters',
    };
  }

  return { valid: true };
}

/**
 * Validate participant ID format
 */
export function validateParticipantIdFormat(participantId: unknown): {
  valid: boolean;
  error?: string;
} {
  if (typeof participantId !== 'string') {
    return { valid: false, error: 'Participant ID must be a string' };
  }

  if (participantId.length < 16) {
    return {
      valid: false,
      error: 'Participant ID must be at least 16 characters',
    };
  }

  return { valid: true };
}
