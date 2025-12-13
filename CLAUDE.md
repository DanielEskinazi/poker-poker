# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anonymous Planning Poker - a real-time collaborative estimation tool for agile teams. Users create sessions, share links with teammates, and vote on story points using Fibonacci cards. The app uses WebSocket for real-time updates.

## Commands

### Development

```bash
# Backend (Terminal 1) - runs on http://localhost:3000
cd backend && npm run dev

# Frontend (Terminal 2) - runs on http://localhost:5173
cd frontend && npm run dev
```

### Testing

```bash
# Backend tests
cd backend && npm test                    # Run all tests
cd backend && npm test -- --watch         # Watch mode
cd backend && npm test contract/          # Contract tests only
cd backend && npm test integration/       # Integration tests only

# Frontend tests
cd frontend && npm test                   # Unit tests
cd frontend && npm run test:e2e           # Playwright E2E tests
cd frontend && npm run test:e2e:ui        # Playwright with UI
```

### Build & Lint

```bash
cd backend && npm run build               # TypeScript compilation
cd frontend && npm run build              # Vite production build
cd backend && npm run lint                # ESLint
cd frontend && npm run lint
```

## Architecture

### Monorepo Structure

```
├── backend/          # Express + Socket.io server
├── frontend/         # React + Vite + Tailwind
└── shared/types/     # Shared TypeScript interfaces
```

### Backend (`backend/src/`)

- **server.ts** - HTTP server bootstrap with graceful shutdown
- **app.ts** - Express app configuration with CORS, routes
- **api/routes/** - REST endpoints (`/api/sessions`, `/api/export`)
- **websocket/socketServer.ts** - Socket.io initialization
- **websocket/handlers/** - WebSocket event handlers:
  - `sessionHandlers.ts` - create-session, join-session events
  - `votingHandlers.ts` - cast-vote, reveal-votes, reset-votes
  - `moderatorHandlers.ts` - promote-moderator
  - `connectionHandlers.ts` - disconnect handling, reconnection
- **services/** - Business logic:
  - `SessionService.ts` - Session CRUD, in-memory storage
  - `ParticipantService.ts` - Participant management
  - `VotingService.ts` - Vote casting, reveal, statistics
  - `ModeratorService.ts` - Moderator promotion, auto-succession
  - `CleanupService.ts` - Session expiration (1 hour TTL)
  - `ExportService.ts` - Excel export functionality

### Frontend (`frontend/src/`)

- **components/** - React components:
  - `HomePage.tsx` - Session creation/join
  - `SessionPage.tsx` - Main voting interface (large file, ~1800 lines)
  - `CardDeck.tsx` - Fibonacci voting cards
  - `ParticipantList.tsx` - Active participants display
  - `VoteCounter.tsx` - Vote progress indicator
  - `ReconnectionBanner.tsx` - Connection status UI
- **services/**:
  - `socketService.ts` - Socket.io client singleton with reconnection
- **hooks/**:
  - `useReconnection.ts` - Connection state management

### Shared Types (`shared/types/`)

TypeScript interfaces used by both backend and frontend:
- `Events.ts` - WebSocket event payloads (client→server, server→client)
- `Session.ts` - SessionMetadata, SessionData, VotingState
- `Participant.ts` - Participant interface
- `Vote.ts` - Vote, VoteRound, VoteStatistics
- `Common.ts` - CardValue type (Fibonacci: 1, 2, 3, 5, 8, 13, 21, "?")

### Real-time Communication

WebSocket events flow:
1. Client emits: `create-session`, `join-session`, `cast-vote`, `reveal-votes`, `reset-votes`, `promote-moderator`
2. Server broadcasts: `session-created`, `join-accepted`, `participant-joined`, `vote-accepted`, `vote-count-updated`, `votes-revealed`, `votes-reset`, `moderator-promoted`

Sessions use Socket.io rooms (room ID = session ID) for targeted broadcasts.

## Key Business Rules

- Sessions expire after 1 hour of inactivity
- Maximum 20 participants per session
- Browser fingerprinting prevents duplicate participants
- Auto-moderator promotion when current moderator disconnects
- Votes hidden until moderator reveals (no peeking)

## Testing Structure

```
backend/tests/
├── contract/      # API contract tests (HTTP + WebSocket)
├── integration/   # Multi-component integration tests
├── unit/          # Unit tests
└── helpers/       # Test utilities
```

## Environment Configuration

Create `.env` in project root:
```env
NODE_ENV=development
PORT=3000
HOST=localhost
CORS_ORIGIN=http://localhost:5173
SESSION_EXPIRY_MS=3600000
MAX_PARTICIPANTS=20
LOG_LEVEL=debug
```
