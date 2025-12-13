# Implementation Plan: Anonymous Planning Poker Session MVP

**Branch**: `001-anonymous-planning-poker` | **Date**: 2025-10-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-anonymous-planning-poker/spec.md`

## Summary

Build a real-time Planning Poker MVP that allows anonymous users to create sessions, invite team members via shareable links, vote on story estimates using Fibonacci cards, and export results to Excel. The system supports up to 20 participants per session with <500ms real-time latency, automatic reconnection, multi-moderator capability, and emoji-based participant differentiation.

**Core Technical Approach**:
- **Frontend**: React 18 + TypeScript + Socket.io-client for real-time UI
- **Backend**: Node.js 20 + Express + Socket.io for WebSocket server
- **Storage**: In-memory (node-cache) with 1-hour TTL, no persistent database
- **Real-time**: Socket.io rooms for efficient session-based broadcasting
- **Export**: Client-side Excel generation using ExcelJS

## Technical Context

**Language/Version**: Node.js 20.x LTS (backend), TypeScript 5.x (frontend + backend)
**Primary Dependencies**:
- Backend: express, socket.io, nanoid, node-cache, exceljs, cors
- Frontend: react@18, socket.io-client, zustand, tailwindcss, exceljs, @fingerprintjs/fingerprintjs

**Storage**: In-memory (node-cache) with automatic 1-hour expiration
**Testing**: Vitest (unit/contract), Playwright (E2E), Artillery (load testing)
**Target Platform**: Web browsers (Chrome 100+, Firefox 100+, Safari 15+, Edge 100+), Node.js server (Linux/Docker)
**Project Type**: Web application (frontend + backend monorepo)

**Performance Goals**:
- Real-time latency: P95 < 500ms for all broadcast events
- Reconnection time: < 3 seconds after network interruption
- Excel export: < 5 seconds for 10-round session
- Concurrent capacity: 1000+ sessions, 20,000+ WebSocket connections per server

**Constraints**:
- Sessions expire after 1 hour of inactivity (non-negotiable)
- Maximum 20 participants per session (hard limit)
- No authentication/persistence in MVP (anonymous only)
- Must work on mobile browsers (iOS Safari, Chrome Mobile)

**Scale/Scope**: MVP targeting 100-500 concurrent sessions, extensible to 10,000+ with Redis scaling

## Constitution Check

**Status**: N/A - Constitution template not yet populated. For MVP, following standard practices:
- Test-Driven Development (TDD): Contract tests → Implementation → Integration tests → E2E tests
- Code quality: TypeScript strict mode, ESLint, Prettier
- Documentation: Inline JSDoc for all public APIs, comprehensive README
- Simplicity: YAGNI principles, no premature optimization

## Project Structure

### Documentation (this feature)

```text
specs/001-anonymous-planning-poker/
├── spec.md              # Feature specification with clarifications
├── plan.md              # This file (implementation plan)
├── research.md          # Technology stack analysis and architectural decisions
├── data-model.md        # Entity schemas and data access patterns
├── quickstart.md        # Developer setup guide and test scenarios
└── contracts/           # API contract definitions
    ├── websocket-events.md    # Socket.io event contracts (18 events)
    └── rest-api.md            # REST endpoint contracts (5 endpoints)
```

### Source Code (repository root)

```text
# Web application structure (backend + frontend)

backend/
├── src/
│   ├── server.ts            # Express + Socket.io server setup
│   ├── app.ts               # Express app configuration
│   ├── config/
│   │   ├── environment.ts   # Environment variables
│   │   └── constants.ts     # App constants (CARD_DECK, MAX_PARTICIPANTS)
│   ├── models/
│   │   ├── Session.ts       # Session entity
│   │   ├── Participant.ts   # Participant entity
│   │   └── Vote.ts          # Vote entity
│   ├── services/
│   │   ├── SessionService.ts          # Session CRUD operations
│   │   ├── ParticipantService.ts      # Participant management
│   │   ├── VotingService.ts           # Vote casting/reveal/reset
│   │   ├── ModeratorService.ts        # Moderator promotion logic
│   │   ├── CleanupService.ts          # Session expiration job
│   │   └── ExportService.ts           # Excel export generation
│   ├── websocket/
│   │   ├── handlers/
│   │   │   ├── sessionHandlers.ts     # create-session, join-session
│   │   │   ├── votingHandlers.ts      # cast-vote, reveal-votes, reset-votes
│   │   │   ├── moderatorHandlers.ts   # promote-moderator
│   │   │   └── connectionHandlers.ts  # connect, disconnect, reconnect
│   │   ├── middleware/
│   │   │   ├── validation.ts          # Input validation
│   │   │   └── rateLimit.ts           # Rate limiting
│   │   └── socketServer.ts            # Socket.io configuration
│   ├── api/
│   │   └── routes/
│   │       ├── sessions.ts            # REST session endpoints
│   │       ├── export.ts              # Excel export endpoint
│   │       └── health.ts              # Health check endpoint
│   └── utils/
│       ├── idGenerator.ts             # nanoid wrappers
│       ├── emojiAssigner.ts           # Emoji avatar logic
│       ├── validation.ts              # Input sanitization
│       └── logger.ts                  # Logging utility
├── tests/
│   ├── contract/
│   │   ├── create-session.test.ts
│   │   ├── join-session.test.ts
│   │   ├── cast-vote.test.ts
│   │   ├── reveal-votes.test.ts
│   │   └── rest-api.test.ts
│   ├── integration/
│   │   ├── voting-round.test.ts
│   │   ├── moderator-succession.test.ts
│   │   ├── session-expiration.test.ts
│   │   └── multi-tab-sync.test.ts
│   └── performance/
│       ├── latency.test.ts
│       └── reconnection.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── .env.example

frontend/
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component with routing
│   ├── components/
│   │   ├── HomePage.tsx         # Landing page with "Create Session"
│   │   ├── SessionPage.tsx      # Main session interface
│   │   ├── CardDeck.tsx         # Fibonacci card selection
│   │   ├── ParticipantList.tsx  # Participant list with status
│   │   ├── VoteCounter.tsx      # "X of Y voted" display
│   │   ├── RevealedVotes.tsx    # Vote results display
│   │   ├── ModeratorControls.tsx # Reveal/Reset/Promote buttons
│   │   └── ExportButton.tsx     # Excel export trigger
│   ├── hooks/
│   │   ├── useWebSocket.ts      # Socket.io connection management
│   │   ├── useSession.ts        # Session state management
│   │   ├── useVoting.ts         # Voting state management
│   │   ├── useParticipants.ts   # Participants state management
│   │   └── useBrowserFingerprint.ts # Fingerprint generation
│   ├── services/
│   │   ├── socketService.ts     # Socket.io client wrapper
│   │   ├── apiService.ts        # REST API client
│   │   ├── exportService.ts     # Excel export logic
│   │   └── storageService.ts    # localStorage abstraction
│   ├── store/
│   │   └── sessionStore.ts      # Zustand store for session state
│   ├── types/
│   │   ├── Session.ts           # TypeScript interfaces (matches backend)
│   │   ├── Participant.ts
│   │   └── Vote.ts
│   └── utils/
│       ├── validation.ts        # Client-side validation
│       └── clipboard.ts         # Copy-to-clipboard utility
├── tests/
│   └── e2e/
│       ├── session-creation.spec.ts
│       ├── voting-workflow.spec.ts
│       ├── moderator-controls.spec.ts
│       ├── excel-export.spec.ts
│       └── reconnection.spec.ts
├── public/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── playwright.config.ts

# Shared (if needed)
shared/
└── types/                       # Shared TypeScript types (optional)
    ├── Session.ts
    ├── Participant.ts
    └── Events.ts                # WebSocket event payloads
```

**Structure Decision**: Web application structure chosen because:
1. Feature requires both frontend UI and backend WebSocket server
2. Monorepo approach simplifies shared type definitions and development workflow
3. Separate `frontend/` and `backend/` directories allow independent deployment
4. Frontend-backend type sharing via `shared/types/` prevents drift

## Complexity Tracking

No constitutional violations - using standard web application patterns.

## Execution Flow

### Phase 0: Research ✅ Complete

**Artifact**: `research.md`

**Decisions Made**:
- Technology stack: React + Node.js + Socket.io + in-memory storage
- Real-time architecture: Socket.io rooms with automatic reconnection
- Browser fingerprinting: FingerprintJS + localStorage for device detection
- Emoji avatars: Hash-based deterministic assignment from 50+ emoji pool
- Excel export: Client-side generation using ExcelJS
- Session expiration: Passive cleanup with 5-minute background job
- Moderator promotion: FIFO algorithm based on join timestamp

---

### Phase 1: Design Artifacts ✅ Complete

#### Data Model (`data-model.md`) ✅

**Entities Defined**:
1. **Session**: sessionId, timestamps, votingState, participants, votes, voteHistory
2. **Participant**: participantId, name, emoji, isModerator, connection state
3. **Vote**: participantId, cardValue, revealed status
4. **VoteRound**: Historical voting round with statistics

**Key Data Operations**:
- Create Session: O(1)
- Join Session: O(n) where n ≤ 20
- Cast Vote: O(1)
- Reveal Votes: O(v) where v ≤ 20
- Reset Votes: O(v + p) where v, p ≤ 20
- Auto-Promote Moderator: O(p log p) where p ≤ 20

**Memory Footprint**: ~10KB per session, supports 10,000 concurrent sessions per 100MB RAM

#### API Contracts (`contracts/`) ✅

**WebSocket Events** (`websocket-events.md`):
- **Total**: 18 events (8 client→server, 10 server→client)
- **Key Events**: create-session, join-session, cast-vote, reveal-votes, reset-votes, promote-moderator, participant-joined/left, moderator-promoted, session-expired
- **Latency Requirements**: P95 < 500ms for all broadcasts
- **Reconnection**: Automatic with state preservation

**REST API** (`rest-api.md`):
- **Total**: 5 endpoints
- **Endpoints**:
  - POST /api/sessions (create)
  - GET /api/sessions/:id (retrieve metadata)
  - GET /api/sessions/:id/participants (list participants)
  - GET /api/sessions/:id/export (Excel download)
  - GET /api/health (monitoring)
- **Rate Limits**: 10-100 req/min depending on endpoint

#### Quickstart Guide (`quickstart.md`) ✅

**Test Scenarios Defined**:
- **Contract Tests**: 3 test files (session creation, join, voting)
- **Integration Tests**: 3 test files (full round, moderator succession, expiration)
- **E2E Tests**: 5 test files (creation, voting workflow, moderator controls, export, reconnection)
- **Performance Tests**: 2 test files (latency measurement, reconnection speed)
- **Manual Checklist**: 30 items covering all user flows

**Development Setup**:
- Environment configuration
- Run scripts for backend/frontend
- Debugging tips and common issues

---

### Phase 2: Tasks (Next Step - Run `/tasks` command)

**Not Yet Generated** - Run `/tasks` command to create `tasks.md` with:
- Dependency-ordered implementation tasks
- TDD workflow (tests → implementation → validation)
- Parallelizable tasks marked with [P]
- Estimated effort per task
- File paths and success criteria

---

## Progress Tracking

| Phase | Status | Artifact | Notes |
|-------|--------|----------|-------|
| Phase 0: Research | ✅ Complete | research.md | Technology decisions finalized |
| Phase 1.1: Data Model | ✅ Complete | data-model.md | 4 entities, 6 operations, memory estimates |
| Phase 1.2: Contracts | ✅ Complete | contracts/ | 18 WebSocket events, 5 REST endpoints |
| Phase 1.3: Quickstart | ✅ Complete | quickstart.md | 15 automated test scenarios, 30 manual checklist |
| Phase 1.4: Plan Summary | ✅ Complete | plan.md | This document |
| Phase 2: Tasks | ⏸️ Pending | tasks.md | Run `/tasks` to generate |
| Phase 3: Implementation | ⏸️ Pending | - | Execute tasks from tasks.md |

---

## Implementation Sequence (High-Level)

**Recommended Order** (details in tasks.md):

1. **Setup & Infrastructure** (Week 1, Days 1-2)
   - Project scaffolding (backend + frontend)
   - Environment configuration
   - Linting, TypeScript, testing setup

2. **Contract Tests (TDD Phase 1)** (Week 1, Days 3-5)
   - Write all WebSocket event contract tests
   - Write all REST endpoint contract tests
   - Verify tests FAIL (no implementation yet)

3. **Backend Core** (Week 2, Days 1-3)
   - Implement Session/Participant/Vote models
   - Implement SessionService, ParticipantService, VotingService
   - Implement WebSocket handlers (create, join, vote, reveal, reset)
   - Verify contract tests PASS

4. **Backend Advanced** (Week 2, Days 4-5)
   - Implement moderator promotion logic
   - Implement session expiration cleanup job
   - Implement Excel export service
   - Add input validation and rate limiting

5. **Frontend Core** (Week 3, Days 1-3)
   - HomePage component (create session)
   - SessionPage layout
   - CardDeck component (vote casting)
   - WebSocket connection management

6. **Frontend Advanced** (Week 3, Days 4-5)
   - ParticipantList with real-time updates
   - ModeratorControls (reveal/reset/promote)
   - RevealedVotes display with statistics
   - Excel export button
   - Browser fingerprinting integration

7. **Integration & E2E Tests** (Week 4, Days 1-3)
   - Multi-participant integration tests
   - Moderator succession tests
   - Session expiration tests
   - Playwright E2E test suite

8. **Polish & Performance** (Week 4, Days 4-5)
   - Reconnection handling with state preservation
   - Emoji avatar system
   - Multi-tab synchronization
   - Performance optimization (latency, memory)
   - Mobile responsiveness

**Total Estimated Time**: 4 weeks (20 working days)

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| WebSocket connection instability | Medium | High | Automatic reconnection with exponential backoff, state preservation |
| Browser fingerprinting fails | Low | Medium | Fallback to localStorage-only with warning |
| In-memory sessions lost on crash | Medium | Medium | Document as known limitation, add Redis in future iteration |
| Excel export performance | Low | Low | Client-side generation tested up to 100 rounds × 20 participants |
| 20-participant limit too restrictive | Low | Medium | Configurable via environment variable, easy to increase |

---

## Next Steps

1. **Run `/tasks` command** to generate detailed task breakdown
2. **Review tasks.md** with team for estimation and assignment
3. **Begin TDD cycle**: Write contract tests → Implement → Verify
4. **Track progress** in tasks.md as tasks are completed
5. **Run `/analyze`** after task generation to verify cross-artifact consistency

---

## Deployment Checklist (Pre-Production)

- [ ] All contract tests passing (100% coverage)
- [ ] All integration tests passing
- [ ] All E2E tests passing
- [ ] Performance tests meet SLAs (P95 < 500ms latency, < 3s reconnection)
- [ ] Load testing completed (1000 concurrent sessions, 20,000 connections)
- [ ] Security audit (input validation, rate limiting, XSS prevention)
- [ ] Browser compatibility verified (Chrome, Firefox, Safari, Edge, iOS, Android)
- [ ] Documentation complete (README, API docs, deployment guide)
- [ ] Monitoring configured (Datadog, Sentry, or equivalent)
- [ ] Environment variables configured for production
- [ ] HTTPS configured with valid SSL certificate
- [ ] CORS origins whitelisted for production domain
- [ ] Backup/disaster recovery plan documented
- [ ] Feature flags configured (gradual rollout strategy)

---

**Plan Status**: ✅ Complete
**Branch**: `001-anonymous-planning-poker`
**Ready for**: Task generation (`/tasks` command)
