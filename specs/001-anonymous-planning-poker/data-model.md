# Data Model: Anonymous Planning Poker Session MVP

**Feature**: Anonymous Planning Poker Session MVP
**Branch**: `001-anonymous-planning-poker`
**Date**: 2025-10-27

## Overview

This document defines the in-memory data structures for the Planning Poker MVP. All data resides in server memory (node-cache) and expires after 1 hour of inactivity. No persistent database is used in MVP.

## Core Entities

### Session

Represents an active Planning Poker estimation session.

**Storage**: Server-side in-memory cache (key: sessionId)

```typescript
interface Session {
  // Identity
  sessionId: string;              // 8-character alphanumeric (nanoid)

  // Lifecycle
  createdAt: number;               // Unix timestamp (ms)
  lastActivityAt: number;          // Unix timestamp (ms) - updated on any action
  expiresAt: number;               // Unix timestamp (ms) - createdAt + 1 hour

  // Content
  storyDescription: string;        // Default: "Story to estimate"

  // State
  votingState: 'voting' | 'revealed';  // Current phase of voting

  // Relationships
  participants: Map<string, Participant>;  // Key: participantId
  votes: Map<string, Vote>;               // Key: participantId
  voteHistory: VoteRound[];               // Array of completed voting rounds

  // Metadata
  participantCount: number;        // Current count (max 20 per FR-031)
  moderatorIds: Set<string>;       // Set of participant IDs with moderator status
}
```

**Constraints**:
- `sessionId`: Unique, 8 characters, alphanumeric only
- `participantCount`: Maximum 20 (FR-031)
- `lastActivityAt`: Must update on any participant action (join, vote, moderator action)
- `expiresAt`: Immutable once set, equals `createdAt + 3600000ms`

**Indexes** (for efficient cleanup):
- By `expiresAt`: B-tree index for finding expired sessions

---

### Participant

Represents a person in a session.

**Storage**: Nested within Session.participants Map

```typescript
interface Participant {
  // Identity
  participantId: string;           // nanoid(16) - unique per participant
  browserFingerprint: string;      // FingerprintJS hash
  name: string;                    // User-provided name (1-50 chars per FR-016)
  emoji: string;                   // Assigned avatar (Unicode emoji character)

  // Session role
  isModerator: boolean;            // True if has moderator privileges
  joinTimestamp: number;           // Unix timestamp (ms) - for FIFO moderator promotion

  // Connection state
  isConnected: boolean;            // True if WebSocket connection active
  socketIds: Set<string>;          // Set of Socket.io connection IDs (multi-tab support)
  lastSeenAt: number;              // Unix timestamp (ms) - for detecting disconnects

  // Voting state
  hasVoted: boolean;               // True if vote cast in current round
  currentVote: CardValue | null;   // null if not voted, value if voted (hidden until reveal)
}
```

**Constraints**:
- `name`: 1-50 characters, sanitized for XSS
- `emoji`: Single Unicode emoji character from predefined list
- `browserFingerprint`: Unique per browser/device per session (enforces FR-028)
- `socketIds`: Can have multiple values (multi-tab), but only one `browserFingerprint` per session

**Relationships**:
- One Participant belongs to exactly one Session
- One browser/device (browserFingerprint) maps to at most one Participant per Session

---

### Vote

Represents a vote cast by a participant.

**Storage**: Nested within Session.votes Map (current round) and Session.voteHistory (past rounds)

```typescript
interface Vote {
  participantId: string;           // Reference to Participant
  participantName: string;         // Snapshot of name at vote time
  participantEmoji: string;        // Snapshot of emoji at vote time
  cardValue: CardValue;            // The vote value
  votedAt: number;                 // Unix timestamp (ms)
  revealed: boolean;               // True if moderator has revealed votes
}

type CardValue = 1 | 2 | 3 | 5 | 8 | 13 | 21 | '?';
```

**Constraints**:
- `cardValue`: Must be one of: 1, 2, 3, 5, 8, 13, 21, '?' (FR-007)
- `revealed`: Starts false, becomes true on moderator reveal action
- `participantName` and `participantEmoji`: Snapshots ensure history remains consistent even if participant changes name in future iterations

**State Transitions**:
1. **Not voted**: No entry in `Session.votes` for participantId
2. **Voted (unrevealed)**: Entry exists with `revealed: false`
3. **Voted (revealed)**: Entry exists with `revealed: true`
4. **Round reset**: All votes moved to `voteHistory`, `Session.votes` cleared

---

### VoteRound

Represents a completed voting round (for history and export).

**Storage**: Nested within Session.voteHistory array

```typescript
interface VoteRound {
  roundNumber: number;             // Sequential counter (1, 2, 3...)
  completedAt: number;             // Unix timestamp (ms)
  storyDescription: string;        // Snapshot of story at round time
  votes: Vote[];                   // All votes from that round
  consensus: boolean;              // True if all votes were identical
  averageVote: number | null;      // Numeric average (excludes '?'), null if no numeric votes
}
```

**Constraints**:
- `roundNumber`: Monotonically increasing per session
- `votes`: Always revealed (archived after reveal)
- `consensus`: Auto-calculated - true if all `cardValue`s are identical (excluding '?')
- `averageVote`: Only calculated from numeric votes (1, 2, 3, 5, 8, 13, 21), ignores '?'

**Usage**:
- Export to Excel (FR-024, FR-025)
- Session history display (future iteration)

---

### CardDeck

Represents the available voting options.

**Storage**: Static constant (not stored per-session)

```typescript
const CARD_DECK: ReadonlyArray<CardValue> = [1, 2, 3, 5, 8, 13, 21, '?'] as const;
```

**Constraints**:
- Fixed for MVP (FR-007)
- Ordered as shown (natural Fibonacci progression + '?')
- Future: Could be per-session configurable

---

## Derived Data

### Vote Statistics (Computed On-Demand)

Not stored, calculated when needed (e.g., for reveal display):

```typescript
interface VoteStatistics {
  totalVotes: number;              // Count of votes cast
  totalParticipants: number;       // Count of active participants
  voteDistribution: Map<CardValue, number>;  // Count per card value
  consensus: boolean;              // All votes identical
  averageNumeric: number | null;   // Average of numeric votes (excludes '?')
  medianNumeric: number | null;    // Median of numeric votes (excludes '?')
}
```

---

## Relationships Diagram

```
Session (1)
  ├── participants (Map<string, Participant>) (1-20)
  │     └── Participant (many)
  │           ├── participantId (PK)
  │           ├── browserFingerprint (Unique per session)
  │           ├── socketIds (Set<string>) (1-many tabs)
  │           └── isModerator (boolean)
  │
  ├── votes (Map<string, Vote>) (0-20 current round)
  │     └── Vote (many)
  │           ├── participantId (FK → Participant)
  │           ├── cardValue (1|2|3|5|8|13|21|'?')
  │           └── revealed (boolean)
  │
  └── voteHistory (VoteRound[]) (0-unlimited past rounds)
        └── VoteRound (many)
              ├── roundNumber (sequential)
              ├── votes (Vote[]) (snapshot)
              └── completedAt (timestamp)
```

---

## Data Access Patterns

### Create Session

```typescript
function createSession(creatorName: string): Session {
  const now = Date.now();
  const sessionId = nanoid(8);
  const creatorId = nanoid(16);
  const emoji = assignRandomEmoji();

  const session: Session = {
    sessionId,
    createdAt: now,
    lastActivityAt: now,
    expiresAt: now + 3_600_000, // 1 hour
    storyDescription: "Story to estimate",
    votingState: 'voting',
    participants: new Map(),
    votes: new Map(),
    voteHistory: [],
    participantCount: 1,
    moderatorIds: new Set([creatorId])
  };

  const creator: Participant = {
    participantId: creatorId,
    browserFingerprint: '', // Set by client
    name: creatorName,
    emoji,
    isModerator: true,
    joinTimestamp: now,
    isConnected: true,
    socketIds: new Set(),
    lastSeenAt: now,
    hasVoted: false,
    currentVote: null
  };

  session.participants.set(creatorId, creator);
  sessionCache.set(sessionId, session);

  return session;
}
```

**Complexity**: O(1)

---

### Join Session

```typescript
function joinSession(
  sessionId: string,
  name: string,
  browserFingerprint: string
): { success: boolean; participant?: Participant; error?: string } {
  const session = sessionCache.get(sessionId);

  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  // Check capacity (FR-031)
  if (session.participantCount >= 20) {
    return { success: false, error: 'Session is full (20 participants max)' };
  }

  // Check for duplicate browser/device (FR-028, FR-030)
  const existingParticipant = Array.from(session.participants.values())
    .find(p => p.browserFingerprint === browserFingerprint);

  if (existingParticipant) {
    // Reconnect existing participant
    existingParticipant.isConnected = true;
    existingParticipant.lastSeenAt = Date.now();
    return { success: true, participant: existingParticipant };
  }

  // Create new participant
  const participantId = nanoid(16);
  const emoji = assignEmojiByHash(participantId);

  const participant: Participant = {
    participantId,
    browserFingerprint,
    name,
    emoji,
    isModerator: false,
    joinTimestamp: Date.now(),
    isConnected: true,
    socketIds: new Set(),
    lastSeenAt: Date.now(),
    hasVoted: false,
    currentVote: null
  };

  session.participants.set(participantId, participant);
  session.participantCount++;
  session.lastActivityAt = Date.now();

  return { success: true, participant };
}
```

**Complexity**: O(n) where n = participant count (max 20)

---

### Cast Vote

```typescript
function castVote(
  sessionId: string,
  participantId: string,
  cardValue: CardValue
): { success: boolean; error?: string } {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  const participant = session.participants.get(participantId);
  if (!participant) {
    return { success: false, error: 'Participant not found' };
  }

  if (session.votingState === 'revealed') {
    return { success: false, error: 'Votes already revealed, reset to vote again' };
  }

  const vote: Vote = {
    participantId,
    participantName: participant.name,
    participantEmoji: participant.emoji,
    cardValue,
    votedAt: Date.now(),
    revealed: false
  };

  session.votes.set(participantId, vote);
  participant.hasVoted = true;
  participant.currentVote = cardValue;
  session.lastActivityAt = Date.now();

  return { success: true };
}
```

**Complexity**: O(1)

---

### Reveal Votes (Moderator Only)

```typescript
function revealVotes(
  sessionId: string,
  moderatorId: string
): { success: boolean; votes?: Vote[]; error?: string } {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (!session.moderatorIds.has(moderatorId)) {
    return { success: false, error: 'Only moderators can reveal votes' };
  }

  if (session.votes.size === 0) {
    return { success: false, error: 'No votes to reveal' };
  }

  // Mark all votes as revealed
  const revealedVotes: Vote[] = [];
  session.votes.forEach(vote => {
    vote.revealed = true;
    revealedVotes.push(vote);
  });

  session.votingState = 'revealed';
  session.lastActivityAt = Date.now();

  return { success: true, votes: revealedVotes };
}
```

**Complexity**: O(v) where v = vote count (max 20)

---

### Reset Votes (Moderator Only)

```typescript
function resetVotes(
  sessionId: string,
  moderatorId: string
): { success: boolean; error?: string } {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (!session.moderatorIds.has(moderatorId)) {
    return { success: false, error: 'Only moderators can reset votes' };
  }

  // Archive current round to history
  if (session.votes.size > 0) {
    const votes = Array.from(session.votes.values());
    const numericVotes = votes
      .filter(v => typeof v.cardValue === 'number')
      .map(v => v.cardValue as number);

    const voteRound: VoteRound = {
      roundNumber: session.voteHistory.length + 1,
      completedAt: Date.now(),
      storyDescription: session.storyDescription,
      votes,
      consensus: new Set(votes.map(v => v.cardValue)).size === 1,
      averageVote: numericVotes.length > 0
        ? numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length
        : null
    };

    session.voteHistory.push(voteRound);
  }

  // Clear current round
  session.votes.clear();
  session.votingState = 'voting';
  session.participants.forEach(p => {
    p.hasVoted = false;
    p.currentVote = null;
  });
  session.lastActivityAt = Date.now();

  return { success: true };
}
```

**Complexity**: O(v + p) where v = votes, p = participants (both max 20)

---

### Promote Moderator

```typescript
function promoteModerator(
  sessionId: string,
  promoterId: string,
  targetParticipantId: string
): { success: boolean; error?: string } {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false, error: 'Session not found' };
  }

  if (!session.moderatorIds.has(promoterId)) {
    return { success: false, error: 'Only moderators can promote others' };
  }

  const targetParticipant = session.participants.get(targetParticipantId);
  if (!targetParticipant) {
    return { success: false, error: 'Target participant not found' };
  }

  if (targetParticipant.isModerator) {
    return { success: false, error: 'Participant is already a moderator' };
  }

  targetParticipant.isModerator = true;
  session.moderatorIds.add(targetParticipantId);
  session.lastActivityAt = Date.now();

  return { success: true };
}
```

**Complexity**: O(1)

---

### Auto-Promote Next Moderator (On Disconnect)

```typescript
function autoPromoteNextModerator(
  sessionId: string,
  departedModeratorId: string
): { success: boolean; newModerator?: Participant } {
  const session = sessionCache.get(sessionId);
  if (!session) {
    return { success: false };
  }

  // Remove departed moderator
  session.moderatorIds.delete(departedModeratorId);

  // If other moderators remain, no auto-promotion needed
  if (session.moderatorIds.size > 0) {
    return { success: true };
  }

  // Find next participant by join timestamp (FIFO)
  const connectedParticipants = Array.from(session.participants.values())
    .filter(p => p.isConnected && p.participantId !== departedModeratorId)
    .sort((a, b) => a.joinTimestamp - b.joinTimestamp);

  if (connectedParticipants.length === 0) {
    // No participants left - session will expire naturally
    return { success: true };
  }

  const newModerator = connectedParticipants[0];
  newModerator.isModerator = true;
  session.moderatorIds.add(newModerator.participantId);
  session.lastActivityAt = Date.now();

  return { success: true, newModerator };
}
```

**Complexity**: O(p log p) where p = participants (max 20)

---

## Data Cleanup

### Session Expiration Job

Runs every 5 minutes (background cron job):

```typescript
function cleanupExpiredSessions(): void {
  const now = Date.now();
  const allSessions = sessionCache.keys();

  for (const sessionId of allSessions) {
    const session = sessionCache.get(sessionId);

    if (session && session.expiresAt < now) {
      // Notify connected participants
      broadcastToSession(sessionId, 'session-expired', {
        message: 'Session has expired due to inactivity'
      });

      // Delete from cache
      sessionCache.del(sessionId);

      console.log(`Cleaned up expired session: ${sessionId}`);
    }
  }
}
```

**Frequency**: Every 5 minutes
**Complexity**: O(s) where s = total sessions

---

## Excel Export Data Structure

When moderator clicks "Export to Excel" (FR-024):

```typescript
interface ExcelExportData {
  sessionInfo: {
    sessionId: string;
    createdAt: string;  // ISO 8601
    totalRounds: number;
  };
  participants: {
    name: string;
    emoji: string;
    isModerator: boolean;
  }[];
  rounds: {
    roundNumber: number;
    storyDescription: string;
    completedAt: string;  // ISO 8601
    votes: {
      participant: string;  // name + emoji
      vote: CardValue;
    }[];
    consensus: boolean;
    average: number | string;  // "N/A" if no numeric votes
  }[];
}
```

**Excel Layout**:
- Sheet 1: "Session Summary" (sessionInfo + participants table)
- Sheet 2: "Voting Rounds" (one row per vote, grouped by round)

---

## Memory Footprint Estimation

### Per Session
```
Session object: ~500 bytes
20 Participants × 200 bytes: 4,000 bytes
20 Votes × 100 bytes: 2,000 bytes
10 VoteRounds × 300 bytes: 3,000 bytes
Total: ~9,500 bytes ≈ 10 KB per session
```

### System Capacity
```
100 MB RAM = ~10,000 concurrent sessions
1 GB RAM = ~100,000 concurrent sessions
```

**MVP Target**: 1,000 concurrent sessions (comfortable margin)

---

## Validation Rules Summary

| Field | Constraint | Error Message |
|-------|------------|---------------|
| Session.sessionId | 8 chars, alphanumeric | "Invalid session ID format" |
| Session.participantCount | ≤ 20 | "Session is full (20 participants max)" |
| Participant.name | 1-50 chars, non-empty | "Name must be 1-50 characters" |
| Participant.browserFingerprint | Unique per session | "You are already in this session" |
| Vote.cardValue | 1\|2\|3\|5\|8\|13\|21\|'?' | "Invalid card value" |
| Vote action | Only if votingState === 'voting' | "Votes already revealed" |
| Reveal action | Only if moderator | "Only moderators can reveal votes" |
| Reveal action | Only if votes exist | "No votes to reveal" |
| Reset action | Only if moderator | "Only moderators can reset votes" |

---

**Data Model Status**: ✅ Complete
**Next Phase**: Phase 1 - API Contracts
