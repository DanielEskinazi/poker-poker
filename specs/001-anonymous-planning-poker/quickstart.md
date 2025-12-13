# Quickstart Guide: Anonymous Planning Poker MVP

**Feature**: Anonymous Planning Poker Session MVP
**Branch**: `001-anonymous-planning-poker`
**Audience**: Developers, QA Engineers, Product Managers

## Overview

This guide provides step-by-step instructions for running, testing, and validating the Planning Poker MVP. Follows Test-Driven Development (TDD) approach: write tests first, see them fail, then implement.

---

## Prerequisites

### Required Software
- Node.js 20.x or higher
- npm 10.x or higher
- Modern browser (Chrome 100+, Firefox 100+, Safari 15+, Edge 100+)

### Optional Tools
- Playwright for E2E tests
- Artillery for load testing
- Excel/Google Sheets for export validation

---

## Project Setup

### 1. Clone and Install

```bash
# Clone repository
git clone https://github.com/yourusername/planning-poker.git
cd planning-poker

# Checkout feature branch
git checkout 001-anonymous-planning-poker

# Install dependencies
npm install

# Install playwright browsers (for E2E tests)
npx playwright install
```

### 2. Environment Configuration

Create `.env` file in project root:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# CORS
CORS_ORIGIN=http://localhost:5173

# Session Configuration
SESSION_EXPIRY_MS=3600000
MAX_PARTICIPANTS=20

# Rate Limiting
RATE_LIMIT_ENABLED=true

# Logging
LOG_LEVEL=debug
```

### 3. Run Development Servers

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

Expected output:
```
[INFO] Server starting on port 3000
[INFO] WebSocket server ready
[INFO] Session cleanup job scheduled (every 5 minutes)
[INFO] Server listening on http://localhost:3000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

### 4. Verify Setup

Open browser to `http://localhost:5173`

Expected: Home page with "Create Session" button

---

## Test Scenarios (TDD Approach)

### Phase 1: Contract Tests (Write First)

These tests define the API contract before implementation.

**Location**: `backend/tests/contract/`

#### Test 1.1: Session Creation Contract

**File**: `backend/tests/contract/create-session.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('POST /api/sessions - Contract', () => {
  it('should return 201 with session data for valid input', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        creatorName: 'Sarah',
        browserFingerprint: 'test_fp_001'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      sessionId: expect.stringMatching(/^[A-Za-z0-9]{8}$/),
      sessionUrl: expect.stringContaining('/session/'),
      participant: {
        participantId: expect.any(String),
        name: 'Sarah',
        emoji: expect.any(String),
        isModerator: true
      },
      createdAt: expect.any(Number)
    });
  });

  it('should return 400 for name too short', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({ creatorName: '', browserFingerprint: 'test_fp_002' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.field).toBe('creatorName');
  });

  it('should return 400 for name too long', async () => {
    const response = await request(app)
      .post('/api/sessions')
      .send({
        creatorName: 'a'.repeat(51),
        browserFingerprint: 'test_fp_003'
      })
      .expect(400);

    expect(response.body.error.field).toBe('creatorName');
  });
});
```

**Run Test** (should FAIL initially):
```bash
npm test contract/create-session
```

Expected output:
```
❌ POST /api/sessions - Contract
  ❌ should return 201 with session data for valid input
     Error: Cannot POST /api/sessions (404)
```

#### Test 1.2: WebSocket Join Session Contract

**File**: `backend/tests/contract/join-session.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io, Socket } from 'socket.io-client';

describe('WebSocket join-session - Contract', () => {
  let socket: Socket;
  let sessionId: string;

  beforeAll(async () => {
    // Create session via REST first
    const response = await fetch('http://localhost:3000/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creatorName: 'Host',
        browserFingerprint: 'test_host'
      })
    });
    const data = await response.json();
    sessionId = data.sessionId;
  });

  afterAll(() => {
    socket?.disconnect();
  });

  it('should emit join-accepted for valid join request', (done) => {
    socket = io('http://localhost:3000');

    socket.emit('join-session', {
      sessionId,
      name: 'Mike',
      browserFingerprint: 'test_mike'
    });

    socket.on('join-accepted', (data) => {
      expect(data).toMatchObject({
        participant: {
          name: 'Mike',
          emoji: expect.any(String),
          isModerator: false
        },
        session: {
          sessionId,
          participantCount: 2
        }
      });
      done();
    });

    socket.on('error', (error) => {
      done(new Error(`Expected join-accepted, got error: ${error.message}`));
    });
  });

  it('should emit error for duplicate browserFingerprint', (done) => {
    const socket2 = io('http://localhost:3000');

    socket2.emit('join-session', {
      sessionId,
      name: 'Mike2',
      browserFingerprint: 'test_mike' // Same as previous test
    });

    socket2.on('error', (error) => {
      expect(error.code).toBe('ALREADY_IN_SESSION');
      socket2.disconnect();
      done();
    });
  });
});
```

**Run Test** (should FAIL):
```bash
npm test contract/join-session
```

#### Test 1.3: Vote Casting Contract

**File**: `backend/tests/contract/cast-vote.test.ts`

```typescript
describe('WebSocket cast-vote - Contract', () => {
  it('should emit vote-accepted and vote-count-updated', (done) => {
    // Setup: join session first
    // Then cast vote
    socket.emit('cast-vote', {
      sessionId,
      participantId,
      cardValue: 5
    });

    socket.on('vote-accepted', (data) => {
      expect(data.cardValue).toBe(5);
    });

    socket.on('vote-count-updated', (data) => {
      expect(data.votedCount).toBe(1);
      expect(data.totalParticipants).toBe(1);
      done();
    });
  });

  it('should reject invalid card value', (done) => {
    socket.emit('cast-vote', {
      sessionId,
      participantId,
      cardValue: 99 // Invalid
    });

    socket.on('error', (error) => {
      expect(error.code).toBe('VALIDATION_ERROR');
      done();
    });
  });
});
```

---

### Phase 2: Integration Tests

Tests that verify multiple components working together.

**Location**: `backend/tests/integration/`

#### Test 2.1: Full Voting Round

**File**: `backend/tests/integration/voting-round.test.ts`

```typescript
describe('Full Voting Round Integration', () => {
  it('should complete: join → vote → reveal → reset', async () => {
    // 1. Create session
    const session = await createSession('Host');

    // 2. Join with 2 more participants
    const participant1 = await joinSession(session.sessionId, 'Alice');
    const participant2 = await joinSession(session.sessionId, 'Bob');

    // 3. All three cast votes
    await castVote(session.sessionId, session.participant.participantId, 5);
    await castVote(session.sessionId, participant1.participantId, 8);
    await castVote(session.sessionId, participant2.participantId, 5);

    // 4. Verify vote count
    const voteCount = await getVoteCount(session.sessionId);
    expect(voteCount).toEqual({ voted: 3, total: 3 });

    // 5. Reveal votes (as moderator)
    const revealed = await revealVotes(
      session.sessionId,
      session.participant.participantId
    );

    expect(revealed.votes).toHaveLength(3);
    expect(revealed.statistics.consensus).toBe(false);
    expect(revealed.statistics.averageNumeric).toBe(6); // (5+8+5)/3

    // 6. Reset votes
    await resetVotes(session.sessionId, session.participant.participantId);

    // 7. Verify votes cleared
    const newVoteCount = await getVoteCount(session.sessionId);
    expect(newVoteCount).toEqual({ voted: 0, total: 3 });
  });
});
```

#### Test 2.2: Moderator Auto-Promotion

**File**: `backend/tests/integration/moderator-succession.test.ts`

```typescript
describe('Moderator Auto-Promotion Integration', () => {
  it('should auto-promote next participant when moderator leaves', async () => {
    // 1. Create session
    const session = await createSession('Host');

    // 2. Join 2 more participants (in order)
    const alice = await joinSession(session.sessionId, 'Alice');
    const bob = await joinSession(session.sessionId, 'Bob');

    // 3. Disconnect original moderator
    await disconnectParticipant(session.participant.participantId);

    // Wait for grace period (30 seconds in real app, mocked in test)
    await waitFor(100);

    // 4. Verify Alice (first to join after host) is now moderator
    const sessionState = await getSessionState(session.sessionId);
    const aliceData = sessionState.participants.find(
      (p) => p.participantId === alice.participantId
    );

    expect(aliceData.isModerator).toBe(true);

    // 5. Verify Bob is still not moderator
    const bobData = sessionState.participants.find(
      (p) => p.participantId === bob.participantId
    );
    expect(bobData.isModerator).toBe(false);
  });
});
```

#### Test 2.3: Session Expiration

**File**: `backend/tests/integration/session-expiration.test.ts`

```typescript
describe('Session Expiration Integration', () => {
  it('should expire session after 1 hour of inactivity', async () => {
    // 1. Create session
    const session = await createSession('Host');

    // 2. Verify session exists
    const initialState = await getSessionState(session.sessionId);
    expect(initialState).toBeDefined();

    // 3. Mock time advance by 1 hour + 1 minute
    jest.advanceTimersByTime(61 * 60 * 1000);

    // 4. Run cleanup job
    await runSessionCleanupJob();

    // 5. Verify session no longer exists
    await expect(getSessionState(session.sessionId)).rejects.toThrow(
      'SESSION_NOT_FOUND'
    );
  });

  it('should NOT expire session with recent activity', async () => {
    // 1. Create session
    const session = await createSession('Host');

    // 2. Advance time by 50 minutes
    jest.advanceTimersByTime(50 * 60 * 1000);

    // 3. Cast a vote (activity)
    await castVote(session.sessionId, session.participant.participantId, 5);

    // 4. Advance time by another 50 minutes (total 100 min, but last activity 50 min ago)
    jest.advanceTimersByTime(50 * 60 * 1000);

    // 5. Run cleanup
    await runSessionCleanupJob();

    // 6. Session should still exist (last activity < 1 hour ago)
    const state = await getSessionState(session.sessionId);
    expect(state).toBeDefined();
  });
});
```

---

### Phase 3: End-to-End (E2E) Tests

Tests from user perspective using real browser.

**Location**: `frontend/tests/e2e/`

#### Test 3.1: Create and Join Session

**File**: `frontend/tests/e2e/session-creation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('user can create and share session', async ({ page }) => {
  // 1. Navigate to home page
  await page.goto('http://localhost:5173');

  // 2. Enter name and create session
  await page.fill('[data-testid="name-input"]', 'Sarah');
  await page.click('[data-testid="create-session-btn"]');

  // 3. Verify redirected to session page
  await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/);

  // 4. Verify moderator badge visible
  await expect(page.locator('[data-testid="moderator-badge"]')).toBeVisible();

  // 5. Copy session link
  await page.click('[data-testid="copy-link-btn"]');

  // 6. Verify clipboard contains session URL
  const clipboardText = await page.evaluate(() =>
    navigator.clipboard.readText()
  );
  expect(clipboardText).toContain('/session/');
});

test('second user can join existing session', async ({ browser }) => {
  // 1. Create session in first context
  const context1 = await browser.newContext();
  const page1 = await context1.newPage();

  await page1.goto('http://localhost:5173');
  await page1.fill('[data-testid="name-input"]', 'Host');
  await page1.click('[data-testid="create-session-btn"]');

  const sessionUrl = page1.url();

  // 2. Join session in second context (different "browser")
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();

  await page2.goto(sessionUrl);
  await page2.fill('[data-testid="name-input"]', 'Guest');
  await page2.click('[data-testid="join-session-btn"]');

  // 3. Verify both users see each other
  await expect(page1.locator('text=Guest 🚀')).toBeVisible(); // Guest with emoji
  await expect(page2.locator('text=Host 🎯')).toBeVisible(); // Host with emoji

  // 4. Verify participant count
  await expect(page1.locator('text=2 participants')).toBeVisible();
  await expect(page2.locator('text=2 participants')).toBeVisible();
});
```

#### Test 3.2: Voting Workflow

**File**: `frontend/tests/e2e/voting-workflow.spec.ts`

```typescript
test('complete voting round from start to finish', async ({ browser }) => {
  // Setup: 3 users in session
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext()
  ]);

  const [page1, page2, page3] = await Promise.all(
    contexts.map((ctx) => ctx.newPage())
  );

  // Create session with page1
  await page1.goto('http://localhost:5173');
  await page1.fill('[data-testid="name-input"]', 'Moderator');
  await page1.click('[data-testid="create-session-btn"]');
  const sessionUrl = page1.url();

  // Join with page2 and page3
  await page2.goto(sessionUrl);
  await page2.fill('[data-testid="name-input"]', 'Alice');
  await page2.click('[data-testid="join-session-btn"]');

  await page3.goto(sessionUrl);
  await page3.fill('[data-testid="name-input"]', 'Bob');
  await page3.click('[data-testid="join-session-btn"]');

  // Step 1: All users cast votes
  await page1.click('[data-testid="card-5"]');
  await page2.click('[data-testid="card-8"]');
  await page3.click('[data-testid="card-5"]');

  // Step 2: Verify vote counter updates for all
  await expect(page1.locator('text=3 of 3 voted')).toBeVisible();
  await expect(page2.locator('text=3 of 3 voted')).toBeVisible();
  await expect(page3.locator('text=3 of 3 voted')).toBeVisible();

  // Step 3: Verify votes are NOT visible yet
  await expect(page2.locator('text=Moderator: 5')).not.toBeVisible();

  // Step 4: Moderator reveals votes
  await page1.click('[data-testid="reveal-votes-btn"]');

  // Step 5: All users see revealed votes
  await expect(page1.locator('text=Moderator 🎯: 5')).toBeVisible();
  await expect(page1.locator('text=Alice 🚀: 8')).toBeVisible();
  await expect(page1.locator('text=Bob ⚡: 5')).toBeVisible();

  await expect(page2.locator('text=Moderator 🎯: 5')).toBeVisible();
  await expect(page3.locator('text=Alice 🚀: 8')).toBeVisible();

  // Step 6: Verify statistics displayed
  await expect(page1.locator('text=Average: 6')).toBeVisible();
  await expect(page1.locator('text=Consensus: No')).toBeVisible();

  // Step 7: Moderator resets votes
  await page1.click('[data-testid="reset-votes-btn"]');

  // Step 8: Verify all users see cleared state
  await expect(page1.locator('text=0 of 3 voted')).toBeVisible();
  await expect(page2.locator('[data-testid="card-8"][data-selected="true"]')).not.toBeVisible();
  await expect(page3.locator('text=Moderator 🎯: 5')).not.toBeVisible();
});
```

#### Test 3.3: Excel Export

**File**: `frontend/tests/e2e/excel-export.spec.ts`

```typescript
test('moderator can export session to Excel', async ({ page }) => {
  // 1. Create session and complete voting round
  await page.goto('http://localhost:5173');
  await page.fill('[data-testid="name-input"]', 'Moderator');
  await page.click('[data-testid="create-session-btn"]');

  await page.click('[data-testid="card-5"]');
  await page.click('[data-testid="reveal-votes-btn"]');

  // 2. Click export button
  const downloadPromise = page.waitForEvent('download');
  await page.click('[data-testid="export-excel-btn"]');
  const download = await downloadPromise;

  // 3. Verify filename
  expect(download.suggestedFilename()).toMatch(
    /^planning-poker-session-[A-Za-z0-9]{8}\.xlsx$/
  );

  // 4. Verify file size (should be > 5KB for valid Excel)
  const path = await download.path();
  const fs = require('fs');
  const stats = fs.statSync(path);
  expect(stats.size).toBeGreaterThan(5000);

  // 5. Verify download completed in <5 seconds (SC-012)
  const downloadTime = Date.now() - download._startTime;
  expect(downloadTime).toBeLessThan(5000);
});
```

---

### Phase 4: Performance Tests

#### Test 4.1: Latency Measurement

**File**: `backend/tests/performance/latency.test.ts`

```typescript
test('vote events broadcast within 500ms (FR-015)', async () => {
  // Setup: 20 participants in session
  const sockets = await createMultipleSockets(20);

  const latencies = [];

  for (let i = 0; i < 20; i++) {
    const startTime = Date.now();

    sockets[i].emit('cast-vote', {
      sessionId,
      participantId: participantIds[i],
      cardValue: 5
    });

    await new Promise((resolve) => {
      sockets[i].on('vote-count-updated', () => {
        const latency = Date.now() - startTime;
        latencies.push(latency);
        resolve();
      });
    });
  }

  // Calculate P95 latency
  latencies.sort((a, b) => a - b);
  const p95Index = Math.floor(latencies.length * 0.95);
  const p95Latency = latencies[p95Index];

  expect(p95Latency).toBeLessThan(500);
  console.log(`P95 latency: ${p95Latency}ms`);
});
```

#### Test 4.2: Reconnection Speed

**File**: `backend/tests/performance/reconnection.test.ts`

```typescript
test('reconnection completes within 3 seconds (SC-016)', async () => {
  // 1. Connect participant
  const socket = await connectToSession(sessionId, 'Alice');

  // 2. Store participant ID
  const participantId = socket.id;

  // 3. Simulate disconnect
  socket.disconnect();

  await waitFor(100);

  // 4. Reconnect and measure
  const startTime = Date.now();

  const newSocket = io('http://localhost:3000', {
    query: { participantId, sessionId }
  });

  await new Promise((resolve) => {
    newSocket.on('reconnection-successful', () => {
      const reconnectTime = Date.now() - startTime;
      expect(reconnectTime).toBeLessThan(3000);
      console.log(`Reconnection time: ${reconnectTime}ms`);
      resolve();
    });
  });
});
```

---

## Manual Testing Checklist

Use this checklist for exploratory testing:

### Session Creation & Joining
- [ ] Create session with valid name
- [ ] Create session with empty name (should fail)
- [ ] Create session with 51-character name (should fail)
- [ ] Copy session link to clipboard
- [ ] Join session with valid name
- [ ] Join full session (20 participants) - 21st should fail
- [ ] Join with duplicate browser/device - should reconnect, not create new participant

### Voting
- [ ] Cast vote on each card (1, 2, 3, 5, 8, 13, 21, ?)
- [ ] Change vote before reveal
- [ ] Vote counter updates in real-time for all participants
- [ ] Non-moderator cannot see "Reveal Votes" button
- [ ] Moderator can reveal votes
- [ ] All participants see revealed votes simultaneously
- [ ] Vote statistics display correctly (average, consensus)

### Moderator Controls
- [ ] Only moderator sees "Reveal Votes" button
- [ ] Only moderator sees "Reset Votes" button
- [ ] Moderator can reset votes after reveal
- [ ] All participants see votes cleared after reset
- [ ] Moderator can promote another participant
- [ ] When moderator leaves, next participant auto-promoted
- [ ] Auto-promotion notification visible to all

### Multi-tab/Browser Behavior
- [ ] Open session in 2 tabs - vote in one tab reflects in other
- [ ] Emoji avatars differentiate users with same name
- [ ] Browser fingerprint prevents duplicate participants

### Network Resilience
- [ ] Disconnect WiFi, reconnect - participant rejoins automatically
- [ ] Vote preserved across reconnection
- [ ] Moderator status preserved across reconnection
- [ ] Reconnection completes within 3 seconds

### Excel Export
- [ ] Moderator can export session
- [ ] Non-moderator cannot export (no button visible)
- [ ] Exported file opens in Excel/Google Sheets
- [ ] Export includes all voting rounds
- [ ] Export includes participant names and emojis
- [ ] Export completes in <5 seconds

### Session Expiration
- [ ] Session warning appears 5 minutes before expiration
- [ ] Session expires after 1 hour of inactivity
- [ ] Activity (vote, join) extends session lifetime
- [ ] Expired session shows error message when accessed

### Mobile Browsers
- [ ] Works on iOS Safari
- [ ] Works on Chrome Mobile (Android)
- [ ] Touch interactions work for card selection
- [ ] Responsive layout adapts to mobile screen

---

## Debugging Tips

### Enable Verbose Logging

```bash
# Backend
LOG_LEVEL=debug npm run dev

# Frontend
VITE_LOG_LEVEL=debug npm run dev
```

### Monitor WebSocket Events

Open browser DevTools Console:

```javascript
// Log all Socket.io events
socket.onAny((eventName, ...args) => {
  console.log(`[Socket] ${eventName}`, args);
});
```

### Inspect Session State

```bash
# Backend console
curl http://localhost:3000/api/sessions/aBcD1234 | jq
```

### Check Latency

```javascript
// Frontend console
socket.on('ping', () => {
  console.log('Ping latency:', socket.io.engine.ping, 'ms');
});
```

---

## Common Issues & Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| CORS error | "Blocked by CORS policy" | Verify `CORS_ORIGIN` in .env matches frontend URL |
| WebSocket not connecting | "WebSocket connection failed" | Check backend is running on port 3000 |
| Votes not updating | Stale vote count | Check Socket.io connection status, verify room join |
| Session not found | 404 error | Session may have expired (check timestamp) |
| Export fails | Download not starting | Verify participant is moderator, check browser permissions |
| Duplicate participant | Same emoji appears twice | Clear localStorage, use different browser fingerprint |

---

**Quickstart Status**: ✅ Complete
**Test Scenarios**: 15 automated + 30 manual checklist items
**Next**: Update plan.md with summary
