# Tasks: Anonymous Planning Poker Session MVP

**Input**: Design documents from `/specs/001-anonymous-planning-poker/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: TDD approach - tests written FIRST, verified to FAIL, then implementation

**Organization**: Tasks grouped by user story to enable independent implementation and testing

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `backend/src/`, `frontend/src/`
- **Tests**: `backend/tests/`, `frontend/tests/`
- All paths relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] **T001** Create project directory structure per plan.md (backend/, frontend/, shared/)
- [X] **T002** Initialize backend Node.js project with package.json, dependencies: express, socket.io, nanoid, node-cache, exceljs, cors
- [X] **T003** Initialize frontend Vite+React project with dependencies: react, socket.io-client, zustand, tailwindcss, exceljs, @fingerprintjs/fingerprintjs
- [X] **T004** [P] Configure backend TypeScript (tsconfig.json, strict mode enabled)
- [X] **T005** [P] Configure frontend TypeScript (tsconfig.json, strict mode enabled)
- [X] **T006** [P] Setup backend linting and formatting (ESLint, Prettier)
- [X] **T007** [P] Setup frontend linting and formatting (ESLint, Prettier)
- [X] **T008** [P] Configure Vitest for backend testing (vitest.config.ts)
- [X] **T009** [P] Configure Playwright for frontend E2E tests (playwright.config.ts)
- [X] **T010** Create .env.example files for both backend and frontend with required environment variables

**Checkpoint**: Basic project structure ready, dependencies installed, tooling configured

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation

- [X] **T011** Create backend/src/config/environment.ts for environment variable loading and validation
- [X] **T012** Create backend/src/config/constants.ts with CARD_DECK array [1,2,3,5,8,13,21,'?'], MAX_PARTICIPANTS=20, SESSION_EXPIRY_MS
- [X] **T013** [P] Create backend/src/models/Session.ts TypeScript interface matching data-model.md
- [X] **T014** [P] Create backend/src/models/Participant.ts TypeScript interface matching data-model.md
- [X] **T015** [P] Create backend/src/models/Vote.ts TypeScript interface matching data-model.md
- [X] **T016** [P] Create backend/src/utils/idGenerator.ts with nanoid wrappers for sessionId and participantId generation
- [X] **T017** [P] Create backend/src/utils/emojiAssigner.ts with 50+ emoji array and hash-based assignment function
- [X] **T018** [P] Create backend/src/utils/validation.ts with DOMPurify for name sanitization, input validation helpers
- [X] **T019** [P] Create backend/src/utils/logger.ts with structured logging utility (winston or pino)
- [X] **T020** Setup backend/src/app.ts with Express app, CORS configuration, JSON parsing middleware
- [X] **T021** Setup backend/src/websocket/socketServer.ts with Socket.io initialization and connection logging
- [X] **T022** Create backend/src/server.ts that combines HTTP server with Socket.io server

### Frontend Foundation

- [X] **T023** [P] Create shared/types/Session.ts with TypeScript interfaces (shared between backend/frontend)
- [X] **T024** [P] Create shared/types/Participant.ts with TypeScript interfaces
- [X] **T025** [P] Create shared/types/Vote.ts with TypeScript interfaces
- [X] **T026** [P] Create shared/types/Events.ts with WebSocket event payload types
- [X] **T027** Create frontend/src/services/socketService.ts with Socket.io client wrapper and connection management
- [X] **T028** Create frontend/src/services/apiService.ts with fetch wrapper for REST API calls
- [X] **T029** Create frontend/src/services/storageService.ts with localStorage abstraction for participantId persistence
- [X] **T030** Create frontend/src/hooks/useBrowserFingerprint.ts using @fingerprintjs/fingerprintjs to generate device ID
- [X] **T031** Setup frontend/src/App.tsx with React Router (routes: /, /session/:sessionId)
- [X] **T032** Configure TailwindCSS with custom theme colors and component classes

**Checkpoint**: Foundation complete - all models, utilities, and base services ready. User story implementation can now begin in parallel.

---

## Phase 3: User Story 1 - Session Creation & Link Sharing (Priority: P1) 🎯 MVP

**Goal**: Users can create sessions and share links

**Independent Test**: Open app, create session, verify unique URL generated, copy link to clipboard

### Tests for User Story 1 (TDD - Write FIRST, Verify FAIL)

- [X] **T033** [P] [US1] Contract test for POST /api/sessions in backend/tests/contract/create-session.test.ts (from quickstart.md)
- [X] **T034** [P] [US1] Contract test for WebSocket create-session event in backend/tests/contract/websocket-create.test.ts
- [X] **T035** [P] [US1] E2E test for session creation flow in frontend/tests/e2e/session-creation.spec.ts

### Implementation for User Story 1

- [X] **T036** [US1] Implement SessionService.createSession() in backend/src/services/SessionService.ts (creates session, assigns emoji, returns session data)
- [X] **T037** [US1] Implement POST /api/sessions endpoint in backend/src/api/routes/sessions.ts (calls SessionService.createSession)
- [X] **T038** [US1] Implement WebSocket handler for create-session event in backend/src/websocket/handlers/sessionHandlers.ts
- [X] **T039** [US1] Create HomePage component in frontend/src/components/HomePage.tsx (name input, create button)
- [X] **T040** [US1] Create useSession hook in frontend/src/hooks/useSession.ts (manages session state, calls create APIs)
- [X] **T041** [US1] Implement session creation flow in HomePage (form submission → API call → redirect)
- [X] **T042** [US1] Add clipboard copy functionality with visual feedback toast in frontend/src/utils/clipboard.ts
- [X] **T043** [US1] Verify contract tests T033-T035 now PASS

**Checkpoint**: Users can create sessions and get shareable links. Test independently before proceeding.

---

## Phase 4: User Story 2 - Joining Existing Session (Priority: P1) 🎯 MVP

**Goal**: Team members can join sessions via shared link

**Independent Test**: Create session in browser 1, copy link, open in browser 2, join with different name, verify both see each other

### Tests for User Story 2 (TDD - Write FIRST, Verify FAIL)

- [X] **T044** [P] [US2] Contract test for WebSocket join-session event in backend/tests/contract/join-session.test.ts (from quickstart.md)
- [X] **T045** [P] [US2] Integration test for multi-user join flow in backend/tests/integration/multi-user-join.test.ts
- [X] **T046** [P] [US2] E2E test for join workflow in frontend/tests/e2e/join-session.spec.ts

### Implementation for User Story 2

- [X] **T047** [US2] Implement ParticipantService.joinSession() in backend/src/services/ParticipantService.ts (validates capacity, checks duplicate fingerprint, adds participant)
- [X] **T048** [US2] Implement WebSocket handler for join-session event in backend/src/websocket/handlers/sessionHandlers.ts (emits join-accepted and participant-joined)
- [X] **T049** [US2] Implement GET /api/sessions/:id endpoint in backend/src/api/routes/sessions.ts (returns session metadata)
- [X] **T050** [US2] Implement GET /api/sessions/:id/participants endpoint in backend/src/api/routes/sessions.ts
- [X] **T051** [US2] Create SessionPage layout component in frontend/src/components/SessionPage.tsx (main session interface container)
- [X] **T052** [US2] Create ParticipantList component in frontend/src/components/ParticipantList.tsx (displays all participants with emojis, moderator badges)
- [X] **T053** [US2] Implement join flow in SessionPage (show join form if not joined, WebSocket connection, handle join events)
- [X] **T054** [US2] Add real-time participant join/leave notifications with toast messages
- [X] **T055** [US2] Implement session capacity limit enforcement (20 participants) with error messaging
- [X] **T056** [US2] Verify contract tests T044-T046 now PASS

**Checkpoint**: Users can join sessions and see other participants in real-time. Test with multiple browsers.

---

## Phase 5: User Story 3 - Real-time Voting on Story (Priority: P1) 🎯 MVP

**Goal**: Participants can vote using Fibonacci cards with real-time vote counting

**Independent Test**: 2-3 users in session, each select different cards, verify vote count updates for everyone without showing values

### Tests for User Story 3 (TDD - Write FIRST, Verify FAIL)

- [X] **T057** [P] [US3] Contract test for WebSocket cast-vote event in backend/tests/contract/cast-vote.test.ts (from quickstart.md)
- [X] **T058** [P] [US3] Integration test for voting flow in backend/tests/integration/voting-flow.test.ts
- [X] **T059** [P] [US3] E2E test for voting workflow in frontend/tests/e2e/voting-workflow.spec.ts

### Implementation for User Story 3

- [X] **T060** [US3] Implement VotingService.castVote() in backend/src/services/VotingService.ts (validates card value, stores vote, updates session state)
- [X] **T061** [US3] Implement WebSocket handler for cast-vote event in backend/src/websocket/handlers/votingHandlers.ts (emits vote-accepted and vote-count-updated)
- [X] **T062** [US3] Implement vote count logic that broadcasts counts without revealing values (preserves privacy per FR-011)
- [X] **T063** [US3] Create CardDeck component in frontend/src/components/CardDeck.tsx (displays Fibonacci cards 1,2,3,5,8,13,21,?, handles selection)
- [X] **T064** [US3] Create VoteCounter component in frontend/src/components/VoteCounter.tsx (displays "X of Y voted" status)
- [X] **T065** [US3] Create useVoting hook in frontend/src/hooks/useVoting.ts (manages voting state, handles cast-vote events)
- [X] **T066** [US3] Integrate CardDeck and VoteCounter into SessionPage with real-time updates
- [X] **T067** [US3] Add visual feedback for card selection (highlighting, disabled state after voting)
- [X] **T068** [US3] Implement vote change functionality (click different card before reveal)
- [X] **T069** [US3] Update ParticipantList to show voting status indicators (checkmarks) per participant
- [X] **T070** [US3] Verify contract tests T057-T059 now PASS

**Checkpoint**: Users can vote and see real-time vote counts. Verify vote values remain hidden. Test with 3+ participants.

---

## Phase 6: User Story 4 - Vote Reveal by Moderator (Priority: P2)

**Goal**: Moderator can reveal all votes simultaneously, all participants see results

**Independent Test**: Multiple users vote, moderator clicks reveal, verify all participants see all votes displayed

### Tests for User Story 4 (TDD - Write FIRST, Verify FAIL)

- [X] **T071** [P] [US4] Contract test for WebSocket reveal-votes event in backend/tests/contract/reveal-votes.test.ts (from quickstart.md)
- [X] **T072** [P] [US4] Integration test for reveal flow in backend/tests/integration/reveal-flow.test.ts
- [X] **T073** [P] [US4] E2E test for moderator reveal in frontend/tests/e2e/moderator-reveal.spec.ts

### Implementation for User Story 4

- [X] **T074** [US4] Implement VotingService.revealVotes() in backend/src/services/VotingService.ts (marks votes as revealed, calculates statistics)
- [X] **T075** [US4] Implement vote statistics calculation (consensus, average, median, distribution) per data-model.md
- [X] **T076** [US4] Implement WebSocket handler for reveal-votes event in backend/src/websocket/handlers/votingHandlers.ts (validates moderator, broadcasts votes-revealed)
- [X] **T077** [US4] Implement moderator-only authorization check for reveal action
- [X] **T078** [US4] Create RevealedVotes component in frontend/src/components/RevealedVotes.tsx (displays all votes with names/emojis, shows statistics)
- [X] **T079** [US4] Create ModeratorControls component in frontend/src/components/ModeratorControls.tsx (Reveal Votes button, visible only to moderators)
- [X] **T080** [US4] Implement reveal votes flow in SessionPage (moderator clicks → WebSocket event → all clients update)
- [X] **T081** [US4] Add vote statistics display (consensus indicator, average, distribution chart)
- [X] **T082** [US4] Disable "Reveal Votes" button when no votes cast or already revealed
- [X] **T083** [US4] Verify contract tests T071-T073 now PASS

**Checkpoint**: Moderator can reveal votes, all participants see results instantly. Test consensus and non-consensus scenarios.

---

## Phase 7: User Story 5 - Reset Votes for New Round (Priority: P2)

**Goal**: Moderator can reset votes to start new voting round

**Independent Test**: Complete voting round, reveal, click reset, verify votes cleared for all participants

### Tests for User Story 5 (TDD - Write FIRST, Verify FAIL)

- [X] **T084** [P] [US5] Contract test for WebSocket reset-votes event in backend/tests/contract/reset-votes.test.ts
- [X] **T085** [P] [US5] Integration test for reset flow in backend/tests/integration/reset-flow.test.ts
- [X] **T086** [P] [US5] E2E test for complete voting cycle (vote→reveal→reset) in frontend/tests/e2e/voting-cycle.spec.ts

### Implementation for User Story 5

- [X] **T087** [US5] Implement VotingService.resetVotes() in backend/src/services/VotingService.ts (archives round to voteHistory, clears current votes)
- [X] **T088** [US5] Implement vote history archiving with VoteRound structure per data-model.md
- [X] **T089** [US5] Implement WebSocket handler for reset-votes event in backend/src/websocket/handlers/votingHandlers.ts (validates moderator, broadcasts votes-reset)
- [X] **T090** [US5] Add "Reset Votes" button to ModeratorControls component (visible only after reveal)
- [X] **T091** [US5] Implement reset votes flow in SessionPage (clear vote state, unhighlight cards, reset counter)
- [X] **T092** [US5] Verify all participants see cleared state simultaneously
- [X] **T093** [US5] Verify contract tests T084-T086 now PASS

**Checkpoint**: Moderator can reset votes and start new rounds. Test multiple consecutive rounds.

---

## Phase 8: User Story 6 - Participant Presence & Status (Priority: P3)

**Goal**: Enhanced participant list with voting status and connection indicators

**Independent Test**: Multiple users, some vote, verify status indicators update, close browser tab, verify participant removed

### Tests for User Story 6 (TDD - Write FIRST, Verify FAIL)

- [X] **T094** [P] [US6] Integration test for participant disconnect handling in backend/tests/integration/disconnect-handling.test.ts
- [X] **T095** [P] [US6] E2E test for participant status indicators in frontend/tests/e2e/participant-status.spec.ts

### Implementation for User Story 6

- [X] **T096** [US6] Implement WebSocket disconnect handler in backend/src/websocket/handlers/connectionHandlers.ts (30-second grace period, broadcast participant-left)
- [X] **T097** [US6] Implement participant connection status tracking in ParticipantService
- [X] **T098** [US6] Enhance ParticipantList component to show voting status indicators (checkmarks, colors)
- [X] **T099** [US6] Add real-time connection status indicators (online/offline)
- [X] **T100** [US6] Implement participant removal on disconnect (after grace period)
- [X] **T101** [US6] Verify contract tests T094-T095 now PASS

**Checkpoint**: Participant list shows real-time voting and connection status. Test disconnect scenarios.

---

## Phase 9: Moderator Management Features

**Purpose**: Multi-moderator support, auto-promotion, manual promotion

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T102** [P] Contract test for WebSocket promote-moderator event in backend/tests/contract/promote-moderator.test.ts
- [ ] **T103** [P] Integration test for moderator auto-promotion in backend/tests/integration/moderator-succession.test.ts (from quickstart.md)

### Implementation

- [ ] **T104** Implement ModeratorService.promoteModerator() in backend/src/services/ModeratorService.ts (manual promotion by existing moderator)
- [ ] **T105** Implement ModeratorService.autoPromoteNextModerator() in backend/src/services/ModeratorService.ts (FIFO algorithm per data-model.md)
- [ ] **T106** Implement WebSocket handler for promote-moderator event in backend/src/websocket/handlers/moderatorHandlers.ts
- [ ] **T107** Integrate auto-promotion logic into disconnect handler (trigger after grace period if last moderator leaves)
- [ ] **T108** Add "Promote to Moderator" button in ParticipantList (visible only to moderators)
- [ ] **T109** Implement moderator promotion notifications (toast messages for all participants)
- [ ] **T110** Update UI to support multiple simultaneous moderators (multiple badges)
- [ ] **T111** Verify contract tests T102-T103 now PASS

**Checkpoint**: Moderator promotion (manual and automatic) works correctly. Test with multiple moderators.

---

## Phase 10: Session Lifecycle Management

**Purpose**: Session expiration, cleanup, warning notifications

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T112** [P] Integration test for session expiration in backend/tests/integration/session-expiration.test.ts (from quickstart.md)
- [ ] **T113** [P] Unit test for cleanup job in backend/tests/unit/cleanup-service.test.ts

### Implementation

- [ ] **T114** Implement CleanupService in backend/src/services/CleanupService.ts (background job runs every 5 minutes)
- [ ] **T115** Implement session expiration logic (check lastActivityAt + 1 hour)
- [ ] **T116** Implement session-expiring warning (sent 5 minutes before expiration)
- [ ] **T117** Implement session-expired event broadcast to all participants
- [ ] **T118** Integrate CleanupService into server.ts with cron schedule
- [ ] **T119** Update all session operations to update lastActivityAt timestamp
- [ ] **T120** Add session expiry warning banner in frontend SessionPage
- [ ] **T121** Add session expired modal with "Create New Session" button
- [ ] **T122** Verify contract tests T112-T113 now PASS

**Checkpoint**: Sessions expire after 1 hour of inactivity. Test with mock time advancement.

---

## Phase 11: Excel Export Feature

**Purpose**: Moderators can export session results to Excel

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T123** [P] Contract test for GET /api/sessions/:id/export endpoint in backend/tests/contract/export-api.test.ts
- [ ] **T124** [P] E2E test for Excel export in frontend/tests/e2e/excel-export.spec.ts (from quickstart.md)

### Implementation

- [ ] **T125** Implement ExportService.generateExcel() in backend/src/services/ExportService.ts (uses exceljs, creates 2-sheet workbook per FR-025)
- [ ] **T126** Implement GET /api/sessions/:id/export endpoint in backend/src/api/routes/export.ts (validates moderator, generates file, streams response)
- [ ] **T127** Add moderator authorization check for export endpoint
- [ ] **T128** Create ExportButton component in frontend/src/components/ExportButton.tsx (visible only to moderators)
- [ ] **T129** Implement frontend exportService in frontend/src/services/exportService.ts (triggers download, handles errors)
- [ ] **T130** Add export functionality to SessionPage (button click → download Excel file)
- [ ] **T131** Add loading indicator and success/error feedback for export
- [ ] **T132** Test export with 10+ voting rounds to verify performance (<5 seconds per SC-012)
- [ ] **T133** Verify contract tests T123-T124 now PASS

**Checkpoint**: Moderators can export session data to Excel. Open exported file in Excel/Google Sheets to verify format.

---

## Phase 12: Reconnection & State Preservation

**Purpose**: Automatic reconnection after network interruption with state preservation

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T134** [P] Integration test for reconnection flow in backend/tests/integration/reconnection.test.ts
- [ ] **T135** [P] Performance test for reconnection speed in backend/tests/performance/reconnection.test.ts (from quickstart.md, target <3 seconds)
- [ ] **T136** [P] E2E test for reconnection in frontend/tests/e2e/reconnection.spec.ts

### Implementation

- [ ] **T137** Implement WebSocket reconnection handler in backend/src/websocket/handlers/connectionHandlers.ts (detects participantId in query params)
- [ ] **T138** Implement participant state restoration (retrieve from session, send reconnection-successful event)
- [ ] **T139** Configure Socket.io client with reconnection settings in frontend/src/services/socketService.ts (exponential backoff, 5 attempts)
- [ ] **T140** Store participantId and sessionId in localStorage on successful join
- [ ] **T141** Implement automatic reconnection flow in useWebSocket hook (pass stored IDs in connection query params)
- [ ] **T142** Implement state restoration in frontend (votes, moderator status, participant list)
- [ ] **T143** Add reconnection UI indicators (reconnecting toast, reconnected confirmation)
- [ ] **T144** Test reconnection by simulating network interruption (disable WiFi, re-enable)
- [ ] **T145** Verify contract tests T134-T136 now PASS and reconnection completes <3 seconds

**Checkpoint**: Users automatically reconnect after network interruption with all state preserved.

---

## Phase 13: Multi-Tab Synchronization

**Purpose**: Same browser/device synchronizes state across multiple tabs

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T146** [P] Integration test for multi-tab sync in backend/tests/integration/multi-tab-sync.test.ts (from quickstart.md)
- [ ] **T147** [P] E2E test for multi-tab behavior in frontend/tests/e2e/multi-tab.spec.ts

### Implementation

- [ ] **T148** Implement browser fingerprint detection on join (reject duplicate fingerprints per FR-028, FR-030)
- [ ] **T149** Implement BroadcastChannel API in frontend/src/services/storageService.ts for cross-tab communication
- [ ] **T150** Implement tab leader election (first tab = leader, others = followers)
- [ ] **T151** Implement state broadcasting from leader tab to follower tabs
- [ ] **T152** Implement follower tab state sync (listen to BroadcastChannel, update UI)
- [ ] **T153** Test multi-tab sync: open 3 tabs, vote in tab 1, verify tabs 2 and 3 update within 500ms
- [ ] **T154** Verify contract tests T146-T147 now PASS

**Checkpoint**: Opening same session in multiple tabs synchronizes state. Test vote changes reflect across all tabs.

---

## Phase 14: Performance Optimization

**Purpose**: Ensure latency and performance targets are met

### Tests (TDD - Write FIRST, Verify FAIL)

- [ ] **T155** [P] Performance test for vote broadcast latency in backend/tests/performance/latency.test.ts (from quickstart.md, target P95 <500ms)
- [ ] **T156** [P] Load test for 1000 concurrent sessions using Artillery

### Implementation

- [ ] **T157** Implement Socket.io latency monitoring in backend/src/utils/logger.ts (log P95 latency per event type)
- [ ] **T158** Optimize WebSocket broadcast logic (use rooms efficiently, minimize payload size)
- [ ] **T159** Implement Redis adapter for Socket.io (optional, for horizontal scaling)
- [ ] **T160** Add request/response compression (gzip/brotli) for REST endpoints
- [ ] **T161** Optimize frontend re-rendering (React.memo, useMemo, useCallback where needed)
- [ ] **T162** Run performance tests T155-T156 and verify all targets met (P95 <500ms latency, 1000 sessions)
- [ ] **T163** Profile memory usage and verify <100MB for 1000 sessions

**Checkpoint**: Performance tests pass. P95 latency <500ms, 1000+ concurrent sessions supported.

---

## Phase 15: Security & Validation

**Purpose**: Input validation, rate limiting, XSS prevention

### Implementation

- [ ] **T164** [P] Implement rate limiting middleware in backend/src/websocket/middleware/rateLimit.ts (per-event limits from rest-api.md)
- [ ] **T165** [P] Implement input validation middleware in backend/src/websocket/middleware/validation.ts (validates all WebSocket payloads)
- [ ] **T166** [P] Add DOMPurify sanitization for all user-provided strings (names, story descriptions)
- [ ] **T167** [P] Implement session ID validation (8 alphanumeric chars, prevent injection)
- [ ] **T168** [P] Add authorization checks for all moderator-only operations
- [ ] **T169** Add security headers to Express app (helmet middleware)
- [ ] **T170** Implement CORS whitelist for production domain
- [ ] **T171** Add rate limit error handling with retry-after headers
- [ ] **T172** Test XSS prevention (attempt script injection in names)
- [ ] **T173** Test rate limits (exceed limits, verify 429 responses)

**Checkpoint**: All security measures in place. Input validation, rate limiting, and XSS prevention working.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, mobile responsiveness, error handling, final touches

### Documentation

- [ ] **T174** [P] Create backend README.md with setup instructions, API documentation
- [ ] **T175** [P] Create frontend README.md with setup instructions, component documentation
- [ ] **T176** [P] Document environment variables in .env.example with descriptions
- [ ] **T177** [P] Add inline JSDoc comments to all public functions and interfaces
- [ ] **T178** [P] Create DEPLOYMENT.md with production deployment instructions

### Mobile & Responsive Design

- [ ] **T179** [P] Implement responsive layout for SessionPage (mobile breakpoints)
- [ ] **T180** [P] Optimize CardDeck for mobile touch interactions
- [ ] **T181** [P] Test on iOS Safari and Chrome Mobile (from SC-007)
- [ ] **T182** [P] Ensure all buttons and cards have adequate touch targets (44x44px minimum)

### Error Handling

- [ ] **T183** [P] Implement global error boundary in React app
- [ ] **T184** [P] Add user-friendly error messages for all error scenarios
- [ ] **T185** [P] Implement error toast notifications with retry actions
- [ ] **T186** [P] Add logging for all critical errors (backend and frontend)

### Final Validation

- [ ] **T187** Run full E2E test suite from quickstart.md (all 15 scenarios)
- [ ] **T188** Complete manual testing checklist from quickstart.md (all 30 items)
- [ ] **T189** Verify all success criteria from spec.md (SC-001 through SC-016)
- [ ] **T190** Code review and refactoring pass
- [ ] **T191** Update deployment checklist from plan.md
- [ ] **T192** Create demo video showing all 6 user stories working end-to-end

**Checkpoint**: Application fully polished, documented, and production-ready.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - start immediately
- **Foundational (Phase 2)**: Depends on Setup - BLOCKS all user stories
- **User Stories (Phases 3-8)**: All depend on Foundational completion
  - Can proceed in priority order (US1→US2→US3→US4→US5→US6)
  - Or in parallel if multiple developers available
- **Phases 9-16**: Can start after relevant user stories complete

### Critical Path (MVP)

For minimal viable product, complete in order:
1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1 (Create session)
4. Phase 4: User Story 2 (Join session)
5. Phase 5: User Story 3 (Vote)
6. Phase 6: User Story 4 (Reveal)

**This gives you a working Planning Poker MVP** (4 core user stories)

Then optionally add:
7. Phase 7: User Story 5 (Reset votes)
8. Phase 9: Moderator management
9. Phase 10: Session expiration
10. Phase 11: Excel export
11. Phases 12-16: Polish features

### Within Each User Story

1. Write tests FIRST (marked TDD)
2. Verify tests FAIL
3. Implement backend services
4. Implement backend handlers/endpoints
5. Implement frontend components
6. Verify tests PASS
7. Manual testing of story

### Parallel Opportunities

**Setup Phase** - All tasks T004-T010 can run in parallel

**Foundational Phase** - Tasks by category can run in parallel:
- T013-T015 (models) in parallel
- T016-T019 (utils) in parallel
- T023-T026 (shared types) in parallel

**Within Each User Story** - All test tasks can run in parallel, then all model tasks

**Across User Stories** - Once Foundational is complete, different developers can work on different user stories simultaneously

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 in parallel:
Task: "Contract test for POST /api/sessions in backend/tests/contract/create-session.test.ts"
Task: "Contract test for WebSocket create-session in backend/tests/contract/websocket-create.test.ts"
Task: "E2E test for session creation in frontend/tests/e2e/session-creation.spec.ts"

# After tests written and failing, launch parallel implementation tasks:
Task: "Implement SessionService.createSession in backend/src/services/SessionService.ts"
Task: "Create HomePage component in frontend/src/components/HomePage.tsx"
```

---

## Implementation Strategy

### MVP First (4 Core User Stories)

1. Complete Phases 1-2: Setup + Foundation (Week 1)
2. Complete Phase 3: User Story 1 - Create sessions (Week 1-2)
3. Complete Phase 4: User Story 2 - Join sessions (Week 2)
4. Complete Phase 5: User Story 3 - Vote (Week 2-3)
5. Complete Phase 6: User Story 4 - Reveal (Week 3)
6. **DEPLOY MVP** - 4 user stories give complete Planning Poker experience

### Incremental Delivery

After MVP deployment, add features incrementally:
- Week 4: Add User Story 5 (Reset), Moderator management, Session expiration
- Week 5: Add Excel export, Reconnection, Multi-tab sync
- Week 6: Performance optimization, Security hardening, Polish

### Parallel Team Strategy

With 3 developers after Foundational phase:
- **Developer A**: User Stories 1 & 2 (Session management)
- **Developer B**: User Stories 3 & 4 (Voting core)
- **Developer C**: User Story 5 & Moderator features

All merge into MVP, then continue with advanced features in parallel.

---

## Task Summary

- **Total Tasks**: 192
- **Setup**: 10 tasks (T001-T010)
- **Foundational**: 22 tasks (T011-T032)
- **User Story 1**: 11 tasks (T033-T043)
- **User Story 2**: 13 tasks (T044-T056)
- **User Story 3**: 14 tasks (T057-T070)
- **User Story 4**: 13 tasks (T071-T083)
- **User Story 5**: 10 tasks (T084-T093)
- **User Story 6**: 8 tasks (T094-T101)
- **Moderator Mgmt**: 10 tasks (T102-T111)
- **Session Lifecycle**: 11 tasks (T112-T122)
- **Excel Export**: 11 tasks (T123-T133)
- **Reconnection**: 12 tasks (T134-T145)
- **Multi-Tab Sync**: 9 tasks (T146-T154)
- **Performance**: 9 tasks (T155-T163)
- **Security**: 10 tasks (T164-T173)
- **Polish**: 19 tasks (T174-T192)

**Estimated Timeline**: 4-6 weeks (20-30 working days)
- MVP (Phases 1-6): 3 weeks
- Full Feature Set: 4-6 weeks depending on parallelization

---

## Notes

- [P] = Can run in parallel (different files, no dependencies)
- [US#] = User story number for traceability
- TDD = Test-Driven Development - write tests first
- Each user story is independently completable and testable
- Commit after logical groups of tasks
- Run tests continuously to catch regressions
- Prioritize P1 user stories for MVP
- Stop at any checkpoint to validate and demo

**Ready for Implementation**: All tasks defined with clear file paths and success criteria. Begin with Phase 1.
