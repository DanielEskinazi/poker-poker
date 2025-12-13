/**
 * Integration Test: Moderator Succession (Auto-Promotion)
 *
 * Tests the automatic moderator promotion workflow when moderators leave:
 * - FIFO algorithm (first-in, first-out) for auto-promotion
 * - Auto-promotion triggered after moderator disconnects
 * - Multiple moderators - no auto-promotion if another moderator remains
 * - Broadcast moderator-promoted event with promotionType: 'auto'
 * - New moderator gains full moderator privileges
 * - Session continues normally after auto-promotion
 */
export {};
//# sourceMappingURL=moderator-succession.test.d.ts.map