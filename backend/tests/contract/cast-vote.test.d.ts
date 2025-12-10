/**
 * Contract Test: WebSocket cast-vote Event
 *
 * Tests the cast-vote event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful vote cast with valid payload
 * 2. Vote change (cast different vote before reveal)
 * 3. Error when session not found
 * 4. Error when participant not found
 * 5. Error when voting state is 'revealed'
 * 6. Error with invalid card value
 * 7. Broadcast vote-count-updated to all participants
 */
export {};
//# sourceMappingURL=cast-vote.test.d.ts.map