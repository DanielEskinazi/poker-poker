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
export declare function createEmptyStoryDetails(): StoryDetails;
/**
 * Check if story details has any content
 */
export declare function hasStoryContent(story: StoryDetails): boolean;
/**
 * Validation constants for story fields
 */
export declare const STORY_VALIDATION: {
    readonly TITLE_MAX_LENGTH: 100;
    readonly DESCRIPTION_MAX_LENGTH: 500;
    readonly ACCEPTANCE_CRITERIA_MAX_LENGTH: 1000;
    readonly TICKET_LINK_MAX_LENGTH: 2000;
};
//# sourceMappingURL=Story.d.ts.map