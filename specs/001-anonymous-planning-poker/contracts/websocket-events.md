# WebSocket Event Contracts

**Feature**: Anonymous Planning Poker Session MVP
**Protocol**: Socket.io v4
**Transport**: WebSocket (with polling fallback)

## Overview

All real-time communication uses Socket.io event-based architecture. Events are organized into client-to-server (C→S) and server-to-client (S→C) patterns.

## Connection Lifecycle

### Client → Server: `connect`

Automatic Socket.io event when WebSocket connection established.

**No explicit payload** - Socket.io handles connection authentication via query parameters.

**Query Parameters**:
```typescript
{
  participantId?: string;        // For reconnection (from localStorage)
  sessionId?: string;            // For reconnection (from URL)
  browserFingerprint: string;    // FingerprintJS hash
}
```

**Response**: Server emits `connection-established` or `reconnection-successful`

---

### Server → Client: `connection-established`

Sent immediately after successful new connection.

**Payload**:
```typescript
{
  socketId: string;              // Socket.io connection ID
  timestamp: number;             // Unix timestamp (ms)
}
```

**Client Action**: Store socketId in memory for debugging

---

### Server → Client: `reconnection-successful`

Sent when client reconnects with existing participantId.

**Payload**:
```typescript
{
  socketId: string;              // New Socket.io connection ID
  participant: Participant;      // Restored participant data
  session: SessionState;         // Current session state
  timestamp: number;
}
```

**Client Action**: Restore UI state, show "Reconnected" notification

---

### Client → Server: `disconnect`

Automatic Socket.io event when connection drops.

**Server Action**:
- Mark participant as `isConnected: false`
- Start 30-second grace period before removing from session
- If moderator disconnects, trigger auto-promotion after grace period

---

## Session Management

### Client → Server: `create-session`

Creates a new Planning Poker session.

**Request Payload**:
```typescript
{
  creatorName: string;           // 1-50 characters
  browserFingerprint: string;    // FingerprintJS hash
}
```

**Validation**:
- `creatorName`: Required, 1-50 chars, sanitized
- `browserFingerprint`: Required, non-empty string

**Success Response**: `session-created` event

**Error Response**: `error` event
```typescript
{
  code: 'VALIDATION_ERROR' | 'SERVER_ERROR';
  message: string;
}
```

---

### Server → Client: `session-created`

Confirms successful session creation.

**Response Payload**:
```typescript
{
  sessionId: string;             // 8-character session ID
  sessionUrl: string;            // Full URL: https://app.com/session/{sessionId}
  participant: Participant;      // Creator's participant data
  timestamp: number;
}
```

**Client Action**: Redirect to `/session/{sessionId}`, store participantId in localStorage

---

### Client → Server: `join-session`

Joins an existing session.

**Request Payload**:
```typescript
{
  sessionId: string;             // 8-character session ID
  name: string;                  // 1-50 characters
  browserFingerprint: string;    // FingerprintJS hash
}
```

**Validation**:
- `sessionId`: Required, 8 alphanumeric chars
- `name`: Required, 1-50 chars, sanitized
- `browserFingerprint`: Required, unique per session
- Session exists and not expired
- Participant count < 20

**Success Response**: `join-accepted` event

**Error Responses**: `error` event
```typescript
{
  code:
    | 'SESSION_NOT_FOUND'
    | 'SESSION_FULL'              // 20 participant limit reached
    | 'ALREADY_IN_SESSION'        // Same browserFingerprint exists
    | 'VALIDATION_ERROR';
  message: string;
}
```

---

### Server → Client: `join-accepted`

Confirms successful join, sent to joining participant only.

**Response Payload**:
```typescript
{
  participant: Participant;      // Joiner's participant data
  session: SessionState;         // Current session state
  timestamp: number;
}
```

**Client Action**: Initialize UI with session data, store participantId in localStorage

---

### Server → All Clients in Session: `participant-joined`

Broadcast to all existing participants when someone new joins.

**Broadcast Payload**:
```typescript
{
  participant: {
    participantId: string;
    name: string;
    emoji: string;
    isModerator: boolean;
  };
  participantCount: number;      // Updated count
  timestamp: number;
}
```

**Client Action**: Add participant to participants list, show notification toast

---

### Server → All Clients in Session: `participant-left`

Broadcast when participant disconnects (after 30-second grace period).

**Broadcast Payload**:
```typescript
{
  participantId: string;
  participantName: string;
  participantEmoji: string;
  participantCount: number;      // Updated count
  timestamp: number;
}
```

**Client Action**: Remove participant from list, show notification toast

---

## Voting

### Client → Server: `cast-vote`

Submits or changes a vote.

**Request Payload**:
```typescript
{
  sessionId: string;
  participantId: string;
  cardValue: 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';
}
```

**Validation**:
- Participant exists in session
- Voting state is 'voting' (not 'revealed')
- cardValue is valid Fibonacci value

**Success Response**: `vote-accepted` event (to voter only)

**Error Response**: `error` event

---

### Server → Client: `vote-accepted`

Confirms vote was recorded, sent to voter only.

**Response Payload**:
```typescript
{
  cardValue: 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';
  timestamp: number;
}
```

**Client Action**: Highlight selected card, update local state

---

### Server → All Clients in Session: `vote-count-updated`

Broadcast to all participants when any vote is cast/changed.

**Broadcast Payload**:
```typescript
{
  votedCount: number;            // Number of participants who have voted
  totalParticipants: number;     // Total participants in session
  hasVoted: Record<string, boolean>;  // { participantId: true/false } (for status indicators)
  timestamp: number;
}
```

**Important**: Vote VALUES are not included - only counts (preserves vote privacy per FR-011, SC-010)

**Client Action**: Update vote counter display ("3 of 5 voted"), update participant status badges

---

### Client → Server: `reveal-votes` (Moderator Only)

Requests to reveal all votes.

**Request Payload**:
```typescript
{
  sessionId: string;
  moderatorId: string;           // Must be a moderator
}
```

**Validation**:
- Participant is moderator
- At least one vote exists
- Voting state is 'voting'

**Success Response**: `votes-revealed` broadcast to all

**Error Response**: `error` event
```typescript
{
  code:
    | 'NOT_MODERATOR'
    | 'NO_VOTES'
    | 'ALREADY_REVEALED';
  message: string;
}
```

---

### Server → All Clients in Session: `votes-revealed`

Broadcast when moderator reveals votes - includes all vote values.

**Broadcast Payload**:
```typescript
{
  votes: Array<{
    participantId: string;
    participantName: string;
    participantEmoji: string;
    cardValue: 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';
  }>;
  statistics: {
    consensus: boolean;          // All votes identical
    averageNumeric: number | null;  // Average of numeric votes
    distribution: Record<string, number>;  // { '5': 3, '8': 2, ... }
  };
  timestamp: number;
}
```

**Client Action**: Display all votes with participant names/emojis, show statistics, enable "Reset" button for moderators

---

### Client → Server: `reset-votes` (Moderator Only)

Resets votes for a new round.

**Request Payload**:
```typescript
{
  sessionId: string;
  moderatorId: string;
}
```

**Validation**:
- Participant is moderator
- Votes have been revealed

**Success Response**: `votes-reset` broadcast to all

**Error Response**: `error` event

---

### Server → All Clients in Session: `votes-reset`

Broadcast when moderator resets votes.

**Broadcast Payload**:
```typescript
{
  roundNumber: number;           // Next round number (for history tracking)
  timestamp: number;
}
```

**Client Action**: Clear all vote displays, unhighlight cards, reset vote counter, hide revealed votes

---

## Moderator Management

### Client → Server: `promote-moderator` (Moderator Only)

Promotes another participant to moderator.

**Request Payload**:
```typescript
{
  sessionId: string;
  promoterId: string;            // Must be existing moderator
  targetParticipantId: string;   // Participant to promote
}
```

**Validation**:
- Promoter is moderator
- Target participant exists
- Target is not already moderator

**Success Response**: `moderator-promoted` broadcast to all

**Error Response**: `error` event

---

### Server → All Clients in Session: `moderator-promoted`

Broadcast when someone becomes moderator (manual or auto-promotion).

**Broadcast Payload**:
```typescript
{
  participantId: string;
  participantName: string;
  participantEmoji: string;
  promotionType: 'manual' | 'auto';  // Auto = triggered by previous moderator leaving
  timestamp: number;
}
```

**Client Action**: Update UI to show moderator badge, enable moderator controls for promoted participant

---

## Session Lifecycle

### Server → All Clients in Session: `session-expiring`

Warning sent 5 minutes before session expires.

**Broadcast Payload**:
```typescript
{
  expiresAt: number;             // Unix timestamp (ms)
  minutesRemaining: number;      // Should be ~5
  message: string;
}
```

**Client Action**: Show warning banner with countdown

---

### Server → All Clients in Session: `session-expired`

Sent when session expires due to 1-hour inactivity.

**Broadcast Payload**:
```typescript
{
  message: string;               // "Session expired due to inactivity"
  timestamp: number;
}
```

**Client Action**: Show modal, disable all interactions, offer "Create New Session" button

---

## Error Handling

### Server → Client: `error`

Generic error event for any failed operation.

**Payload**:
```typescript
{
  code:
    | 'VALIDATION_ERROR'
    | 'SESSION_NOT_FOUND'
    | 'SESSION_FULL'
    | 'ALREADY_IN_SESSION'
    | 'NOT_MODERATOR'
    | 'NO_VOTES'
    | 'ALREADY_REVEALED'
    | 'PARTICIPANT_NOT_FOUND'
    | 'SERVER_ERROR';
  message: string;               // Human-readable error
  context?: Record<string, any>; // Optional additional context
  timestamp: number;
}
```

**Client Action**: Show error toast/modal, log to console

---

## Latency Requirements

Per FR-015: All broadcasts must reach clients within **500ms** of server processing.

**Monitoring**: Socket.io built-in latency tracking
```typescript
socket.on('ping', () => {
  console.log('Ping latency:', socket.io.engine.ping, 'ms');
});
```

**Expected Latencies**:
- Local network: 5-50ms
- Same region (cloud): 50-150ms
- Cross-region: 150-300ms
- Mobile networks: 100-400ms

**P95 Target**: <450ms (leaves margin for 500ms SLA)

---

## Reconnection Strategy

Socket.io automatic reconnection parameters:

```typescript
const socket = io('https://api.planningpoker.com', {
  reconnection: true,
  reconnectionDelay: 1000,       // Start at 1 second
  reconnectionDelayMax: 5000,    // Max 5 seconds between attempts
  reconnectionAttempts: 5,       // Try 5 times before giving up
  timeout: 20000                 // 20 second connection timeout
});
```

**Flow**:
1. Connection drops
2. Client waits 1 second, attempts reconnection
3. On reconnect, sends `participantId` in query params
4. Server emits `reconnection-successful` with state
5. Client restores UI (satisfies SC-016: <3 second reconnection)

---

## Room Management

Socket.io rooms are used for efficient broadcasting:

**Server-side**:
```typescript
// Join session room
socket.join(`session:${sessionId}`);

// Broadcast to session
io.to(`session:${sessionId}`).emit('participant-joined', payload);

// Leave session room (on disconnect)
socket.leave(`session:${sessionId}`);
```

**Benefits**:
- O(1) broadcast to all session participants
- Automatic cleanup when socket disconnects
- No manual participant list iteration needed

---

## Security Considerations

### Rate Limiting

Per-event rate limits (per socket):
- `create-session`: 10 per hour
- `join-session`: 5 per minute
- `cast-vote`: 100 per session
- `reveal-votes`: 10 per minute
- `reset-votes`: 10 per minute

**Enforcement**: Server-side middleware, returns `error` event with `code: 'RATE_LIMIT_EXCEEDED'`

### Input Sanitization

All string inputs sanitized with `DOMPurify` before storage:
- Participant names
- Session descriptions (future)

**Prevents**: XSS attacks, script injection

### Authorization

Moderator-only events (`reveal-votes`, `reset-votes`, `promote-moderator`) verify:
```typescript
if (!session.moderatorIds.has(moderatorId)) {
  socket.emit('error', {
    code: 'NOT_MODERATOR',
    message: 'Only moderators can perform this action'
  });
  return;
}
```

---

**Contract Status**: ✅ Complete
**Event Count**: 18 events (8 C→S, 10 S→C)
**Next**: REST API Contracts (if needed)
