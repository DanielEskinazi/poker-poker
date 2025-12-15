# Story Details Feature Design

## Overview

Add structured story details to Planning Poker sessions, allowing teams to capture context about what they're estimating. Moderators can set story details at session creation and edit them during the session.

## Data Model

### New StoryDetails Interface

```typescript
// shared/types/Story.ts
interface StoryDetails {
  title: string;              // Required when any field filled, max 100 chars
  description: string;        // Optional, max 500 chars
  acceptanceCriteria: string; // Optional, max 1000 chars
  ticketLink: string;         // Optional, valid URL
}
```

### Session Type Updates

```typescript
// shared/types/Session.ts
interface SessionData {
  // ... existing fields
  story: StoryDetails;  // Replaces storyDescription: string
}
```

### Validation Rules

| Field | Required | Max Length | Format |
|-------|----------|------------|--------|
| title | When any field filled | 100 | Plain text |
| description | No | 500 | Plain text |
| acceptanceCriteria | No | 1000 | Plain text |
| ticketLink | No | 2000 | Valid URL |

## WebSocket Events

### Client → Server

```typescript
// update-story event
interface UpdateStoryPayload {
  sessionId: string;
  story: StoryDetails;
}
```

### Server → Client

```typescript
// story-updated event
interface StoryUpdatedPayload {
  sessionId: string;
  story: StoryDetails;
  updatedBy: string;  // participantId
}
```

## UI Components

### HomePage - Session Creation

- Collapsible "Story Details" section below name input
- Collapsed by default with "Add story details (optional)" toggle
- Fields: Title, Description (textarea), Acceptance Criteria (textarea), Ticket Link
- All fields optional at creation

### SessionPage - Story Panel

Fixed-width left panel (320px) displaying story details:

```
┌─────────────────────────┐
│ 📋 Story Details  [Edit]│  ← Edit visible to moderators only
├─────────────────────────┤
│ Title                   │
│ "User login flow"       │
├─────────────────────────┤
│ Description             │
│ "Allow users to..."     │
├─────────────────────────┤
│ Acceptance Criteria     │
│ • Must validate email   │
│ • Show error states     │
├─────────────────────────┤
│ 🔗 JIRA-1234           │  ← Clickable, opens new tab
└─────────────────────────┘
```

### Inline Editing (Moderators Only)

- Click field to activate edit mode
- Input/textarea replaces display text
- Save/Cancel buttons appear
- Auto-save on blur or Enter (single-line)
- Changes broadcast to all participants in real-time

### Empty State

- "No story details yet" message
- "Add details" button for moderators

### Mobile Layout

- Story panel collapses to accordion above voting cards
- Tap to expand/collapse

## Implementation Files

### Backend

| File | Changes |
|------|---------|
| `shared/types/Story.ts` | New file - StoryDetails interface |
| `shared/types/Session.ts` | Update SessionData, SessionMetadata |
| `shared/types/Events.ts` | Add UpdateStoryPayload, StoryUpdatedPayload |
| `backend/src/models/Session.ts` | Update Session model |
| `backend/src/services/SessionService.ts` | Handle story in creation |
| `backend/src/websocket/handlers/votingHandlers.ts` | Add update-story handler |
| `backend/src/services/ExportService.ts` | Include structured story in export |

### Frontend

| File | Changes |
|------|---------|
| `frontend/src/components/StoryPanel.tsx` | New component - story display |
| `frontend/src/components/EditableField.tsx` | New component - inline editing |
| `frontend/src/components/HomePage.tsx` | Add story form section |
| `frontend/src/components/SessionPage.tsx` | Integrate story panel |
| `frontend/src/services/socketService.ts` | Add story events |

## Migration

Existing sessions with `storyDescription` string will be migrated:
- `storyDescription` value → `story.description`
- Other fields default to empty strings

## Testing

- Unit tests for StoryDetails validation
- Integration tests for update-story WebSocket flow
- E2E tests for inline editing workflow
- E2E tests for story panel display
