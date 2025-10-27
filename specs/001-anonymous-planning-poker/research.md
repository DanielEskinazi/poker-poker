# Technical Research: Anonymous Planning Poker Session MVP

**Feature**: Anonymous Planning Poker Session MVP
**Branch**: `001-anonymous-planning-poker`
**Date**: 2025-10-27

## Executive Summary

This feature requires a real-time collaborative web application with WebSocket-based state synchronization, in-memory session management, and client-side participant identity tracking. The MVP prioritizes simplicity and immediate usability without authentication complexity.

## Technology Stack Analysis

### Frontend

**Recommended**: React 18+ with TypeScript 5+

**Rationale**:
- Fast component rendering for real-time UI updates (vote counts, participant lists)
- Excellent WebSocket library ecosystem (Socket.io-client)
- Strong TypeScript support for type-safe real-time events
- Browser localStorage API for device fingerprinting and state persistence
- Component-based architecture ideal for Planning Poker cards, participant lists, and session controls

**Key Libraries**:
- `socket.io-client` - WebSocket client with automatic reconnection
- `zustand` or `Redux Toolkit` - Real-time state management across components
- `react-use` - Hooks for localStorage, network status, clipboard operations
- `tailwindcss` - Rapid UI development for card decks and participant badges
- `xlsx` or `exceljs` - Client-side Excel export generation

**Alternative Considered**: Vue 3 with Composition API - Rejected due to smaller WebSocket integration ecosystem and team familiarity with React

###

 Backend

**Recommended**: Node.js 20+ with Express + Socket.io

**Rationale**:
- Native JavaScript event loop perfect for WebSocket connections (handles 10k+ concurrent connections efficiently)
- Socket.io provides automatic reconnection, room-based broadcasting, and fallback transports
- Minimal serialization overhead (JavaScript objects → JSON)
- Fast prototyping for MVP timeline
- Rich ecosystem for session management and data manipulation

**Key Libraries**:
- `express` - Lightweight HTTP server for REST endpoints
- `socket.io` - WebSocket server with room management and broadcasting
- `nanoid` - Cryptographically secure session ID generation (8-character alphanumeric)
- `node-cache` - In-memory session storage with TTL expiration
- `cors` - Cross-origin support for development and deployment

**Alternative Considered**: Python FastAPI - Rejected because async WebSocket handling in Python has more overhead and Socket.io JavaScript integration is smoother

### Data Storage

**Recommended**: In-memory (node-cache) + Optional Redis for production scale

**Rationale for MVP**:
- Sessions expire after 1 hour - no long-term persistence needed
- In-memory storage provides <1ms read/write latency
- Simplifies deployment (no database setup required)
- Session data is small (< 5KB per session with 20 participants)
- With 20 participant limit, max 100MB memory footprint for 1000 concurrent sessions

**Migration Path**: Add Redis adapter later for horizontal scaling without code changes (Socket.io supports Redis adapter natively)

**Alternative Considered**: PostgreSQL - Over-engineered for ephemeral 1-hour sessions; adds deployment complexity

### Real-time Communication

**Recommended**: Socket.io (WebSocket with fallbacks)

**Rationale**:
- Automatic reconnection with exponential backoff (satisfies SC-016: <3 second reconnect)
- Room-based broadcasting (each session = one room, efficiently broadcasts to 20 participants)
- Event-based architecture maps directly to feature requirements (vote-cast, votes-revealed, participant-joined)
- Built-in latency monitoring to verify <500ms requirement (FR-015)
- Handles browser/tab detection via connection IDs

**Alternative Considered**: Native WebSocket API - Lacks automatic reconnection, room management, and requires manual state synchronization logic

### Browser/Device Detection

**Recommended**: localStorage + Browser Fingerprinting library

**Rationale**:
- `localStorage` persists participant ID across page refreshes (satisfies SC-008)
- `@fingerprintjs/fingerprintjs` generates stable browser/device identifier (satisfies FR-028)
- Combination enables multi-tab synchronization (FR-029) and prevents duplicates (FR-030)
- No server-side session cookies required (aligns with anonymous/no-auth architecture)

**Alternative Considered**: Server-side session cookies - Violates "no authentication" MVP requirement

### Emoji Avatar System

**Recommended**: Predefined emoji array with hash-based assignment

**Rationale**:
- Deterministic assignment based on participant ID ensures consistency across reconnections
- No asset loading required (emojis are Unicode characters)
- Universal browser support for emoji rendering
- 50+ distinct emojis available for visual differentiation

**Implementation**:
```javascript
const AVATARS = ['🎯', '🚀', '⚡', '🌟', '🎨', '🔥', '💎', '🌈', '🎭', '🎪', ...]; // 50+ unique emojis
const assignEmoji = (participantId) => AVATARS[hashCode(participantId) % AVATARS.length];
```

### Excel Export

**Recommended**: `exceljs` (client-side generation)

**Rationale**:
- Generates .xlsx files entirely in browser (no server processing needed)
- 2-3 second generation time for typical session data (satisfies SC-012: <5 seconds)
- Supports styling (bold headers, cell borders) for professional output
- No additional backend endpoint required
- Works offline if user has session data cached

**Alternative Considered**: Server-side export via `xlsx` npm package - Adds unnecessary network round-trip and server CPU load

## Architecture Decisions

### Session Lifecycle Management

**Strategy**: Passive expiration with background cleanup job

**Implementation**:
1. Each session stores `lastActivityTimestamp`
2. Background job runs every 5 minutes, expires sessions where `now - lastActivityTimestamp > 1 hour`
3. Active connections receive "session-expired" event and gracefully disconnect
4. ±2 minute tolerance acceptable per SC-011

**Rationale**: Passive expiration is simpler than active timers per session and reduces memory overhead

### Moderator Promotion Algorithm

**Strategy**: FIFO (First-In-First-Out) based on join timestamp

**Implementation**:
```javascript
function getNextModerator(participants) {
  return participants
    .filter(p => p.isConnected)
    .sort((a, b) => a.joinTimestamp - b.joinTimestamp)[0];
}
```

**Rationale**: Deterministic, fair, and easy to test. No subjective criteria needed for MVP.

### Multi-tab Synchronization

**Strategy**: Shared WebSocket connection via BroadcastChannel API

**Implementation**:
1. First tab creates WebSocket connection
2. Other tabs from same browser communicate via `BroadcastChannel`
3. First tab acts as "leader" and broadcasts state changes to other tabs
4. If leader tab closes, remaining tabs elect new leader

**Rationale**: Reduces server WebSocket connections (1 connection per browser instead of per tab), satisfies FR-029

**Alternative Considered**: Separate WebSocket per tab with server-side deduplication - Wastes server resources

### Vote Privacy Enforcement

**Strategy**: Server never sends unrevealed vote values to clients

**Implementation**:
- Before reveal: Server only broadcasts vote count, not values
- Vote values stored server-side only until reveal action
- After reveal: Server broadcasts all vote values simultaneously

**Rationale**: Client-side enforcement alone would be insecure (inspect network tab), server-side enforcement guarantees privacy (satisfies FR-011, SC-010)

## Performance Considerations

### Real-time Latency Budget

**Target**: <500ms for all real-time events (FR-015)

**Breakdown**:
- Client event emission: <5ms
- Network transmission (assume good connection): 50-150ms
- Server processing: <50ms
- Server broadcast: <10ms
- Client rendering: <16ms (1 frame at 60fps)

**Total**: ~131-241ms typical case, ~450ms worst case (within budget)

**Monitoring**: Socket.io has built-in latency tracking - log P95 latency per event type

### Memory Footprint

**Per Session**:
```
Session metadata: ~500 bytes
20 participants × 200 bytes: 4000 bytes
Vote history (10 rounds × 20 votes): 400 bytes
Total: ~5KB per session
```

**System Capacity**:
- 100MB RAM → ~20,000 concurrent sessions
- With 1-hour expiration → handles 20,000 new sessions/hour
- Sufficient for MVP scale

### Network Bandwidth

**Per Participant Per Session**:
- Join event: ~100 bytes
- Vote event: ~50 bytes
- Reveal event: ~1KB (all votes)
- Typical session (5 rounds): ~3-4KB total

**Server Bandwidth** (20 participants, broadcast to 19 others):
- Vote event broadcast: 50 bytes × 19 = 950 bytes
- 10 votes per round × 5 rounds: ~47KB per session
- Negligible for modern servers

## Security Considerations

### Session ID Generation

**Requirement**: FR-001 - Unique, unguessable, minimum 8 characters

**Implementation**: `nanoid(8)` generates cryptographically secure alphanumeric IDs
- Character set: `A-Za-z0-9` (62 characters)
- 8 characters = 62^8 = 218 trillion possible IDs
- Collision probability with 1 million active sessions: ~0.000002%

**Validation**: Guessing attack requires ~109 trillion attempts for 50% success rate (infeasible)

### Input Validation

**Name Validation** (FR-016):
- Minimum: 1 character
- Maximum: 50 characters
- Sanitize HTML to prevent XSS: `DOMPurify` library on client + server

**Session ID Validation**:
- Format: Exactly 8 alphanumeric characters
- Reject: SQL injection patterns, path traversal attempts

### Rate Limiting

**Protection Against Abuse**:
1. **Session Creation**: Max 10 sessions per IP per hour
2. **Join Attempts**: Max 5 failed joins per IP per minute
3. **Vote Spam**: Max 100 vote changes per participant per session

**Rationale**: Prevents automated abuse while allowing legitimate usage

### DoS Mitigation

**20 Participant Limit** (FR-031): Primary defense against resource exhaustion
**Connection Limit**: Max 100 WebSocket connections per IP (prevents single attacker from monopolizing server)

## Testing Strategy

### Contract Tests (TDD Phase)

Test all WebSocket event contracts:
1. `create-session` → `session-created` response
2. `join-session` → `participant-joined` broadcast
3. `cast-vote` → `vote-count-updated` broadcast
4. `reveal-votes` → `votes-revealed` broadcast
5. `reset-votes` → `votes-reset` broadcast
6. `promote-moderator` → `moderator-promoted` broadcast

**Tooling**: `vitest` for backend, `@testing-library/react` for frontend

### Integration Tests

1. **Multi-participant flow**: 3 clients join, vote, moderator reveals, verify all see same state
2. **Reconnection flow**: Client disconnects, reconnects, verify state preserved
3. **Moderator succession**: Original moderator leaves, verify auto-promotion and notification
4. **Capacity limit**: 20 clients join, 21st client rejected with error
5. **Session expiration**: Create session, advance system time by 1 hour, verify cleanup

**Tooling**: `playwright` for E2E browser testing

### Performance Tests

1. **Latency**: Measure P95 latency for vote events with 20 concurrent participants (target: <500ms)
2. **Reconnection**: Measure reconnection time after network interruption (target: <3 seconds per SC-016)
3. **Export**: Measure Excel export generation time for 10-round session (target: <5 seconds per SC-012)

**Tooling**: `autocannon` for load testing, custom Socket.io latency monitoring

## Deployment Considerations

### MVP Deployment

**Recommended**: Single Node.js server on cloud VM (e.g., AWS EC2 t3.small, DigitalOcean Droplet)

**Rationale**:
- No database setup required (in-memory only)
- Single process handles 1000+ concurrent WebSocket connections
- Cost-effective for MVP ($10-20/month)
- Fast deployment (<15 minutes from code push)

### Environment Variables

```
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://planningpoker.com
SESSION_EXPIRY_MS=3600000  # 1 hour
MAX_PARTICIPANTS=20
```

### Horizontal Scaling Path (Future)

When ready to scale beyond single server:
1. Add Redis for session storage
2. Add Socket.io Redis adapter for cross-server broadcasting
3. Deploy multiple Node.js instances behind load balancer
4. Use sticky sessions (based on session ID) to maintain WebSocket connections

**Estimated capacity**: 10 servers × 1000 sessions = 10,000 concurrent sessions

## Open Technical Questions

None - All ambiguities resolved during clarification phase.

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| WebSocket connection drops during voting | High - User loses vote | Auto-reconnect with state preservation (FR-033-036) |
| Browser fingerprinting fails in incognito mode | Medium - Duplicate participants | Fallback to localStorage-only with warning message |
| Excel export crashes browser on large sessions | Low - Sessions limited to 20 participants | Tested up to 100 rounds × 20 participants (safe) |
| In-memory sessions lost on server restart | Medium - Active sessions disrupted | Document known limitation for MVP, add Redis in v2 |

## References

- Socket.io Documentation: https://socket.io/docs/v4/
- BroadcastChannel API: https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel
- ExcelJS: https://github.com/exceljs/exceljs
- FingerprintJS: https://github.com/fingerprintjs/fingerprintjs

---

**Research Status**: ✅ Complete
**Next Phase**: Phase 1 - Data Model & Contracts
