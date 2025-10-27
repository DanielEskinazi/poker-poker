/**
 * Common shared types
 * Used by both backend and frontend
 */

/**
 * Card values for Planning Poker
 */
export type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';

/**
 * Card deck array
 */
export const CARD_DECK: readonly CardValue[] = [1, 2, 3, 5, 8, 13, 21, '?'] as const;
