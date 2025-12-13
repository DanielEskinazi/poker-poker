/**
 * Contract Test: WebSocket join-session Event
 *
 * Tests the join-session event contract according to specs/001-anonymous-planning-poker/contracts/websocket-events.md
 *
 * Tests:
 * 1. Successful join with valid payload
 * 2. Join with session not found error
 * 3. Join with session full error (20 participants)
 * 4. Join with duplicate browser fingerprint error
 * 5. Join with validation errors (missing/invalid fields)
 * 6. Broadcast participant-joined to all existing participants
 */
export {};
//# sourceMappingURL=join-session.test.d.ts.map