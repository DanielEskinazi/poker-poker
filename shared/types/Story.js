/**
 * Story Details Type Definitions
 * Used by both backend and frontend for structured story information
 */
/**
 * Create an empty StoryDetails object
 */
export function createEmptyStoryDetails() {
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
export function hasStoryContent(story) {
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
};
//# sourceMappingURL=Story.js.map