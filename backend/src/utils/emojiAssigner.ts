import { EMOJI_AVATARS } from '../config/constants.js';

/**
 * Simple hash function for strings
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Assign an emoji avatar based on participant ID (deterministic)
 */
export function assignEmojiByHash(participantId: string): string {
  const hash = hashString(participantId);
  const index = hash % EMOJI_AVATARS.length;
  return EMOJI_AVATARS[index] as string;
}

/**
 * Assign a random emoji avatar
 */
export function assignRandomEmoji(): string {
  const index = Math.floor(Math.random() * EMOJI_AVATARS.length);
  return EMOJI_AVATARS[index] as string;
}

/**
 * Get all available emoji avatars
 */
export function getAllEmojis(): readonly string[] {
  return EMOJI_AVATARS;
}
