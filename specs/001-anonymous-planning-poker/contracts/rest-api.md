# REST API Contracts

**Feature**: Anonymous Planning Poker Session MVP
**Base URL**: `https://api.planningpoker.com` (production) or `http://localhost:3000` (development)
**Protocol**: HTTP/1.1 or HTTP/2
**Content-Type**: `application/json`

## Overview

REST API handles non-real-time operations like session creation metadata, Excel export, and session queries. Real-time operations use WebSocket events (see `websocket-events.md`).

---

## Session Endpoints

### POST /api/sessions

Creates a new Planning Poker session (alternative to WebSocket `create-session`).

**Use Case**: Initial HTTP request before establishing WebSocket connection.

**Request**:
```http
POST /api/sessions HTTP/1.1
Host: api.planningpoker.com
Content-Type: application/json

{
  "creatorName": "Sarah",
  "browserFingerprint": "abc123def456"
}
```

**Request Body**:
```typescript
{
  creatorName: string;           // 1-50 characters
  browserFingerprint: string;    // FingerprintJS hash
}
```

**Success Response** (201 Created):
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "sessionId": "aBcD1234",
  "sessionUrl": "https://app.planningpoker.com/session/aBcD1234",
  "participant": {
    "participantId": "p_1234567890abcdef",
    "name": "Sarah",
    "emoji": "🎯",
    "isModerator": true
  },
  "createdAt": 1703001234567
}
```

**Error Responses**:

**400 Bad Request** (Validation Error):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name must be 1-50 characters",
    "field": "creatorName"
  }
}
```

**500 Internal Server Error**:
```json
{
  "error": {
    "code": "SERVER_ERROR",
    "message": "Failed to create session"
  }
}
```

**Rate Limit**: 10 requests per IP per hour

---

### GET /api/sessions/:sessionId

Retrieves session metadata and current state.

**Use Case**: Initial page load to check if session exists before connecting WebSocket.

**Request**:
```http
GET /api/sessions/aBcD1234 HTTP/1.1
Host: api.planningpoker.com
```

**Success Response** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "sessionId": "aBcD1234",
  "createdAt": 1703001234567,
  "expiresAt": 1703004834567,
  "participantCount": 5,
  "votingState": "voting",
  "isExpired": false
}
```

**Response Body**:
```typescript
{
  sessionId: string;
  createdAt: number;             // Unix timestamp (ms)
  expiresAt: number;             // Unix timestamp (ms)
  participantCount: number;      // Current count (0-20)
  votingState: 'voting' | 'revealed';
  isExpired: boolean;            // True if past expiresAt
}
```

**Error Responses**:

**404 Not Found** (Session doesn't exist or expired):
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found or has expired"
  }
}
```

**Rate Limit**: 100 requests per IP per minute

---

### GET /api/sessions/:sessionId/participants

Retrieves list of participants in a session.

**Use Case**: Initial state load before WebSocket connection established.

**Request**:
```http
GET /api/sessions/aBcD1234/participants HTTP/1.1
Host: api.planningpoker.com
```

**Success Response** (200 OK):
```json
{
  "participants": [
    {
      "participantId": "p_1234567890abcdef",
      "name": "Sarah",
      "emoji": "🎯",
      "isModerator": true,
      "isConnected": true,
      "joinedAt": 1703001234567
    },
    {
      "participantId": "p_abcdef1234567890",
      "name": "Mike",
      "emoji": "🚀",
      "isModerator": false,
      "isConnected": true,
      "joinedAt": 1703001245678
    }
  ],
  "count": 2
}
```

**Error Responses**: Same as GET /api/sessions/:sessionId

**Rate Limit**: 100 requests per IP per minute

---

## Export Endpoint

### GET /api/sessions/:sessionId/export

Generates Excel file with session voting history.

**Use Case**: Moderator clicks "Export to Excel" button (FR-024, FR-025).

**Request**:
```http
GET /api/sessions/aBcD1234/export?participantId=p_1234567890abcdef HTTP/1.1
Host: api.planningpoker.com
Accept: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
```

**Query Parameters**:
```typescript
{
  participantId: string;         // Required - must be a moderator
}
```

**Success Response** (200 OK):
```http
HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="planning-poker-session-aBcD1234.xlsx"
Content-Length: 15234

[Binary Excel file data]
```

**Excel File Structure**:

**Sheet 1: "Session Summary"**
| Field | Value |
|-------|-------|
| Session ID | aBcD1234 |
| Created | 2025-10-27 14:32:15 |
| Total Rounds | 5 |
| Participants | 5 |

**Participants Table**:
| Name | Emoji | Role |
|------|-------|------|
| Sarah | 🎯 | Moderator |
| Mike | 🚀 | Participant |
| Lisa | ⚡ | Participant |

**Sheet 2: "Voting Rounds"**
| Round | Story | Participant | Vote | Timestamp |
|-------|-------|-------------|------|-----------|
| 1 | Story to estimate | Sarah 🎯 | 5 | 2025-10-27 14:35:22 |
| 1 | Story to estimate | Mike 🚀 | 8 | 2025-10-27 14:35:24 |
| 1 | Story to estimate | Lisa ⚡ | 5 | 2025-10-27 14:35:26 |
| **1** | **Average** | | **6** | |
| **1** | **Consensus** | | **No** | |
| 2 | Story to estimate | Sarah 🎯 | 8 | 2025-10-27 14:40:15 |
| ... | ... | ... | ... | ... |

**Error Responses**:

**403 Forbidden** (Non-moderator attempting export):
```json
{
  "error": {
    "code": "NOT_MODERATOR",
    "message": "Only moderators can export session data"
  }
}
```

**404 Not Found** (Session doesn't exist):
```json
{
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session not found or has expired"
  }
}
```

**Rate Limit**: 10 exports per session per hour (prevents abuse)

**Performance Target**: File generation completes in <5 seconds (SC-012)

---

## Health Check Endpoint

### GET /api/health

Server health check for monitoring and load balancers.

**Request**:
```http
GET /api/health HTTP/1.1
Host: api.planningpoker.com
```

**Success Response** (200 OK):
```json
{
  "status": "healthy",
  "uptime": 345678,              // Seconds
  "timestamp": 1703001234567,
  "version": "1.0.0",
  "metrics": {
    "activeSessions": 123,
    "activeConnections": 456,
    "memoryUsageMB": 234
  }
}
```

**Unhealthy Response** (503 Service Unavailable):
```json
{
  "status": "unhealthy",
  "error": "Database connection lost"
}
```

**Rate Limit**: None (public endpoint)

---

## Error Response Format

All error responses follow consistent structure:

```typescript
{
  error: {
    code: ErrorCode;             // Machine-readable error code
    message: string;             // Human-readable description
    field?: string;              // Optional - which field caused error
    details?: Record<string, any>;  // Optional - additional context
    timestamp: number;           // Unix timestamp (ms)
  }
}
```

**Standard Error Codes**:
```typescript
type ErrorCode =
  | 'VALIDATION_ERROR'           // 400 - Invalid input
  | 'SESSION_NOT_FOUND'          // 404 - Session doesn't exist
  | 'SESSION_FULL'               // 400 - 20 participant limit reached
  | 'NOT_MODERATOR'              // 403 - Action requires moderator
  | 'RATE_LIMIT_EXCEEDED'        // 429 - Too many requests
  | 'SERVER_ERROR';              // 500 - Unexpected server error
```

---

## CORS Configuration

**Allowed Origins** (Production):
```
https://app.planningpoker.com
https://www.planningpoker.com
```

**Allowed Origins** (Development):
```
http://localhost:3000
http://localhost:5173  (Vite dev server)
```

**Allowed Methods**:
```
GET, POST, OPTIONS
```

**Allowed Headers**:
```
Content-Type, Authorization
```

**Exposed Headers**:
```
Content-Disposition  (for Excel downloads)
```

**CORS Preflight Cache**: 24 hours

---

## Rate Limiting

Rate limits enforced per IP address using sliding window algorithm:

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/sessions | 10 requests | 1 hour |
| GET /api/sessions/:id | 100 requests | 1 minute |
| GET /api/sessions/:id/participants | 100 requests | 1 minute |
| GET /api/sessions/:id/export | 10 requests | 1 hour |
| GET /api/health | Unlimited | - |

**Rate Limit Response** (429 Too Many Requests):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

**Headers**:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1703001234567
Retry-After: 45
```

---

## Authentication

**MVP**: No authentication required (anonymous sessions per requirements)

**Future**: JWT tokens for authenticated sessions
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Compression

**Response Compression**: gzip or brotli (negotiated via `Accept-Encoding` header)

**Minimum Size**: 1KB (smaller responses not compressed)

**Example**:
```http
Accept-Encoding: gzip, deflate, br
```

Response:
```http
Content-Encoding: br
```

---

## Caching

**Cache Headers**:

Session metadata (semi-static):
```http
Cache-Control: private, max-age=30
ETag: "abc123def456"
```

Export endpoint (dynamic):
```http
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
```

Health check:
```http
Cache-Control: no-cache
```

---

## API Versioning

**MVP**: No versioning (implied v1)

**Future**: Version in URL path
```
https://api.planningpoker.com/v1/sessions
https://api.planningpoker.com/v2/sessions
```

**Deprecation Policy**: 6 months notice before removing old version

---

## Testing Contracts

### Contract Test Example (Backend)

```typescript
describe('POST /api/sessions', () => {
  it('should create session with valid input', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        creatorName: 'Sarah',
        browserFingerprint: 'abc123'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      sessionId: expect.stringMatching(/^[A-Za-z0-9]{8}$/),
      participant: {
        name: 'Sarah',
        isModerator: true
      }
    });
  });

  it('should reject empty name', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        creatorName: '',
        browserFingerprint: 'abc123'
      })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Integration Test Example (E2E)

```typescript
test('full session flow via REST + WebSocket', async () => {
  // 1. Create session via REST
  const createResponse = await fetch('http://localhost:3000/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creatorName: 'Sarah',
      browserFingerprint: 'test123'
    })
  });
  const { sessionId, participant } = await createResponse.json();

  // 2. Connect WebSocket
  const socket = io('http://localhost:3000', {
    query: { participantId: participant.participantId, sessionId }
  });

  // 3. Cast vote
  socket.emit('cast-vote', {
    sessionId,
    participantId: participant.participantId,
    cardValue: 5
  });

  await waitForEvent(socket, 'vote-accepted');

  // 4. Export session
  const exportResponse = await fetch(
    `http://localhost:3000/api/sessions/${sessionId}/export?participantId=${participant.participantId}`
  );
  expect(exportResponse.headers.get('content-type')).toContain('spreadsheetml');
});
```

---

**REST API Status**: ✅ Complete
**Endpoint Count**: 5 endpoints (3 session, 1 export, 1 health)
**Total Contract Files**: 2 (WebSocket + REST)
