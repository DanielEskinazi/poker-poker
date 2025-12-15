/**
 * Story Details Type Definitions
 * Used by both backend and frontend for structured story information
 */

/**
 * Structured story details for Planning Poker sessions
 */
export interface StoryDetails {
  /** Story title - required when any field is filled, max 100 chars */
  title: string;
  /** Story description - optional, max 500 chars */
  description: string;
  /** Acceptance criteria - optional, max 1000 chars */
  acceptanceCriteria: string;
  /** Link to ticket (Jira, Linear, etc.) - optional, valid URL */
  ticketLink: string;
}

/**
 * Create an empty StoryDetails object
 */
export function createEmptyStoryDetails(): StoryDetails {
  return {
    title: '',
    description: '',
    acceptanceCriteria: '',
    ticketLink: '',
  };
}

/**
 * Check if story details has any content
 */
export function hasStoryContent(story: StoryDetails): boolean {
  return !!(story.title || story.description || story.acceptanceCriteria || story.ticketLink);
}

/**
 * Validation constants for story fields
 */
export const STORY_VALIDATION = {
  TITLE_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  ACCEPTANCE_CRITERIA_MAX_LENGTH: 1000,
  TICKET_LINK_MAX_LENGTH: 2000,
} as const;
