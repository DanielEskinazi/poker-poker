# Feature Specification: Anonymous Planning Poker Session MVP

**Feature Branch**: `001-anonymous-planning-poker`
**Created**: 2025-10-27
**Status**: Draft
**Input**: User description: "Anonymous Planning Poker Session MVP - Users can create a planning poker session by entering their name (no authentication required), get a unique shareable link, and invite team members who can join by entering their names. The session supports real-time voting on a single story using standard Fibonacci cards (1, 2, 3, 5, 8, 13, 21, ?). The session creator becomes the moderator who can reveal all votes simultaneously. All participants see real-time updates when others join, vote, or when votes are revealed. The UI shows vote counts without revealing individual values until the moderator reveals them. After reveal, everyone sees all votes and can discuss. The moderator can reset votes for a new round. This provides a complete, usable Planning Poker experience that can be enhanced with authentication, multiple stories, and persistence in later iterations."

## Clarifications

### Session 2025-10-27

- Q: When the moderator leaves or disconnects from a session, what should happen to the session? → A: Auto-promote the next person who joined as the new moderator, and allow moderators to promote other participants to moderator status
- Q: How long should inactive sessions persist before being cleaned up or expired? → A: 1 hour after inactivity, but there should also be an export function to Excel
- Q: When a user tries to join a session with a name that's already taken, or opens the same session link in multiple tabs, what should happen? → A: Users can have the same name (assign emojis to differentiate), but only one user per browser/device
- Q: Should there be a maximum participant limit per session to prevent abuse or performance issues? → A: 20 participants max
- Q: When a participant loses network connection and then reconnects, how should they rejoin the session? → A: Auto-rejoin - Automatically reconnect to the same session with preserved identity and state

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Session Creation & Link Sharing (Priority: P1)

A team member wants to start an estimation session. They visit the app, enter their name (e.g., "Sarah"), and click "Create Session". The system generates a unique session with a shareable URL like `app.com/session/abc123`. Sarah copies this link and shares it with her team via Slack, email, or any communication tool. This establishes the foundation for collaborative estimation.

**Why this priority**: Without the ability to create and share sessions, no other functionality can be used. This is the absolute foundation - the entry point to the entire application.

**Independent Test**: Can be fully tested by opening the app, creating a session, and verifying a unique URL is generated that can be copied and shared. Delivers immediate value by proving the session creation mechanism works.

**Acceptance Scenarios**:

1. **Given** I am on the home page, **When** I enter my name "Sarah" and click "Create Session", **Then** a new session is created and I am redirected to a unique session URL
2. **Given** I am in a session I created, **When** I view the session page, **Then** I see a "Copy Link" button that copies the full session URL to my clipboard
3. **Given** I created a session, **When** I look at the page, **Then** I am identified as the session moderator with appropriate UI indicators
4. **Given** I am on the home page, **When** I try to create a session without entering a name, **Then** I see a validation error prompting me to enter my name

---

### User Story 2 - Joining Existing Session (Priority: P1)

Team members receive a session link from the moderator. When they click the link, they land on a join page where they enter their name (e.g., "Mike", "Lisa", "Carlos") and click "Join Session". They are immediately added to the session and see the Planning Poker interface. All existing participants see a real-time notification that a new person has joined (e.g., "Mike joined the session").

**Why this priority**: Creating sessions is useless if people can't join them. This completes the basic connectivity requirement and enables collaborative usage.

**Independent Test**: Can be fully tested by creating a session with one user, copying the link, opening it in a different browser/tab, joining with a different name, and verifying both users see each other. Delivers value by proving real-time multi-user functionality works.

**Acceptance Scenarios**:

1. **Given** I have a session link, **When** I visit the URL and enter my name "Mike", **Then** I join the session and see the Planning Poker interface
2. **Given** I am already in a session, **When** another user joins, **Then** I see a real-time notification that they joined (e.g., "Lisa joined")
3. **Given** I am in a session, **When** I look at the participants list, **Then** I see all participant names including myself
4. **Given** I visit a session link, **When** I try to join without entering a name, **Then** I see a validation error
5. **Given** I visit an invalid or expired session link, **When** the page loads, **Then** I see an error message indicating the session doesn't exist

---

### User Story 3 - Real-time Voting on Story (Priority: P1)

Once in a session, all participants see a single story to estimate (with a default placeholder like "Story to estimate"). Each participant sees the standard Fibonacci card deck (1, 2, 3, 5, 8, 13, 21, ?). They click a card to cast their vote. Their card becomes highlighted to show it's selected. All participants see a real-time vote counter (e.g., "3 of 5 voted") but cannot see individual vote values. Participants can change their vote before reveal by clicking a different card.

**Why this priority**: This is the core value proposition - the actual estimation functionality. Without voting, the app has no purpose.

**Independent Test**: Can be fully tested by having 2-3 users in a session, each selecting different cards, and verifying the vote count updates in real-time for everyone without revealing individual choices. Delivers the core Planning Poker value.

**Acceptance Scenarios**:

1. **Given** I am in a session, **When** I click a card value (e.g., "5"), **Then** my card is visually highlighted and the vote count increases for all participants
2. **Given** I have already voted, **When** I click a different card, **Then** my vote changes and the count remains accurate
3. **Given** I am in a session, **When** other participants vote, **Then** I see the vote count update in real-time (e.g., "2 of 4 voted") without seeing their card values
4. **Given** I am in a session, **When** I look at the card deck, **Then** I see all Fibonacci values: 1, 2, 3, 5, 8, 13, 21, and ? (unknown)
5. **Given** I am not the moderator, **When** I look at the interface, **Then** I do NOT see a "Reveal Votes" button

---

### User Story 4 - Vote Reveal by Moderator (Priority: P2)

The session moderator (creator) sees a "Reveal Votes" button that becomes enabled once at least one person has voted. When the moderator clicks "Reveal Votes", all participants instantly see everyone's votes displayed next to their names (e.g., "Sarah: 5, Mike: 8, Lisa: 5, Carlos: 13"). The cards remain visible for discussion. The moderator now sees a "Reset Votes" button.

**Why this priority**: Vote reveal completes the voting cycle and enables the core Planning Poker workflow. Without it, users can vote but never see results, making the feature incomplete. However, the system is still testable without this - users can vote and see counts.

**Independent Test**: Can be fully tested by having multiple users vote, then having the moderator click reveal, and verifying all participants see all votes displayed correctly. Delivers the "reveal" moment that Planning Poker is known for.

**Acceptance Scenarios**:

1. **Given** I am the moderator and at least one person has voted, **When** I click "Reveal Votes", **Then** all participants immediately see all votes with names (e.g., "Mike: 8, Lisa: 5")
2. **Given** I am the moderator and no one has voted, **When** I look at the interface, **Then** the "Reveal Votes" button is disabled or hidden
3. **Given** I am a participant (not moderator), **When** the moderator reveals votes, **Then** I see all votes appear instantly in real-time
4. **Given** votes have been revealed, **When** I look at my interface, **Then** I see the story along with all revealed votes for team discussion
5. **Given** I am the moderator and votes are revealed, **When** I look at the interface, **Then** I see a "Reset Votes" button to start a new round

---

### User Story 5 - Reset Votes for New Round (Priority: P2)

After votes are revealed and the team discusses the estimates, the moderator clicks "Reset Votes". This clears all votes for all participants in real-time, unhighlights all cards, resets the vote counter to "0 voted", and hides the revealed votes. The interface returns to the pre-voting state so the team can vote again on the same story or a different aspect.

**Why this priority**: Enables multiple estimation rounds without creating new sessions. Important for usability but the app is viable without it (users could refresh or create new sessions).

**Independent Test**: Can be fully tested by completing a voting round, revealing votes, clicking reset, and verifying all participants see votes cleared and can vote again. Delivers convenience for re-estimation scenarios.

**Acceptance Scenarios**:

1. **Given** I am the moderator and votes are revealed, **When** I click "Reset Votes", **Then** all votes are cleared for all participants in real-time
2. **Given** I am a participant and the moderator resets votes, **When** the reset happens, **Then** my previously selected card becomes unhighlighted and I can vote again
3. **Given** votes have been reset, **When** I look at the interface, **Then** the vote counter shows "0 voted" and no revealed votes are visible
4. **Given** I am not the moderator, **When** I look at the interface, **Then** I do NOT see a "Reset Votes" button

---

### User Story 6 - Participant Presence & Status (Priority: P3)

All participants see a persistent participants list showing who is in the session. Each participant shows their name and voting status (voted vs. not voted) with visual indicators like checkmarks or colored badges. When someone leaves the session (closes browser/tab), they are removed from the list in real-time for all remaining participants.

**Why this priority**: Enhances awareness and coordination but not strictly required for core functionality. Users can vote without seeing detailed participant status.

**Independent Test**: Can be fully tested by joining with multiple users, voting with some but not others, and verifying the status indicators update correctly for everyone. Delivers improved team awareness.

**Acceptance Scenarios**:

1. **Given** I am in a session, **When** I look at the participants list, **Then** I see all participant names with indicators showing who has voted (e.g., checkmark icon)
2. **Given** I am in a session, **When** another participant votes, **Then** their status indicator updates in real-time to show they voted
3. **Given** I am in a session with multiple participants, **When** someone closes their browser, **Then** they are removed from the participants list in real-time
4. **Given** I am the moderator, **When** I look at the participants list, **Then** I have a clear indicator (e.g., crown icon, "Moderator" badge) showing my role

---

### Edge Cases

- **What happens when the moderator leaves the session?** The system automatically promotes the next person who joined (by join timestamp) to moderator status. All participants see a notification (e.g., "Mike is now the moderator"). The new moderator can also manually promote other participants to moderator status, allowing for multiple moderators.

- **What happens when a user tries to join a session twice (same link in two tabs)?** The system detects the same browser/device using browser fingerprinting or local storage and links all tabs to the same participant identity. Only one active connection per browser/device is allowed. Users with duplicate names are differentiated by randomly assigned emoji avatars (e.g., "Mike 🎯" vs "Mike 🚀").

- **How long should sessions persist?** Sessions automatically expire after 1 hour of inactivity (no participant joins, votes, or moderator actions). Before expiration, moderators can export session results to Excel format, preserving voting history, participant names, and timestamps for offline analysis.

- **What happens when the story description is very long?** Does it truncate, scroll, or expand? Need UI constraints.

- **What happens if 50+ people try to join one session?** Sessions are limited to a maximum of 20 participants. When the 20th participant joins, the 21st person attempting to join receives an error message indicating the session is full and cannot accept more participants.

- **What happens to voting state during network disconnection?** When a participant loses connection and reconnects, the system automatically rejoins them to the same session with their previous identity (name, emoji avatar, moderator status) and state (current vote if any) preserved. This happens transparently without requiring the user to re-enter information or click the session link again.

- **Can participants change their name after joining?** Or is the initial name permanent for that session?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST generate unique, unguessable session IDs (minimum 8 characters, alphanumeric) for each new session
- **FR-002**: System MUST allow users to create a session by providing only their name (no email, password, or authentication required)
- **FR-003**: System MUST designate the session creator as the moderator with exclusive reveal and reset privileges
- **FR-004**: System MUST provide a copyable session URL that allows anyone with the link to join
- **FR-005**: System MUST allow users to join existing sessions by providing their name
- **FR-006**: System MUST broadcast participant join/leave events to all active session participants in real-time
- **FR-007**: System MUST display standard Fibonacci voting cards: 1, 2, 3, 5, 8, 13, 21, and ? (unknown/unsure)
- **FR-008**: System MUST allow each participant to select exactly one card value as their vote
- **FR-009**: System MUST allow participants to change their vote before the reveal
- **FR-010**: System MUST show real-time vote count (e.g., "3 of 5 voted") to all participants without revealing individual votes
- **FR-011**: System MUST prevent non-moderators from revealing or resetting votes
- **FR-012**: System MUST allow the moderator to reveal all votes simultaneously when at least one vote is cast
- **FR-013**: System MUST display all revealed votes with participant names (e.g., "Sarah: 5, Mike: 8") to all participants in real-time
- **FR-014**: System MUST allow the moderator to reset votes, clearing all vote data and returning to pre-voting state
- **FR-015**: System MUST broadcast vote events (cast, changed, revealed, reset) to all participants with <500ms latency
- **FR-016**: System MUST validate that names are non-empty (minimum 1 character, maximum 50 characters)
- **FR-017**: System MUST handle participant disconnections gracefully and update participant lists in real-time
- **FR-018**: System MUST display a default story placeholder (e.g., "Story to estimate") until story editing is implemented in future iterations
- **FR-019**: System MUST automatically promote the next participant (by join timestamp) to moderator when the current moderator leaves or disconnects
- **FR-020**: System MUST allow moderators to promote any participant to moderator status, supporting multiple simultaneous moderators
- **FR-021**: System MUST broadcast moderator promotion events (auto-promotion or manual promotion) to all participants in real-time
- **FR-022**: System MUST expire and clean up sessions after 1 hour of inactivity (no joins, votes, reveals, resets, or moderator actions)
- **FR-023**: System MUST track last activity timestamp for each session to determine inactivity period
- **FR-024**: System MUST allow moderators to export session results to Excel format (.xlsx) at any time
- **FR-025**: Exported Excel file MUST include: session ID, all participant names, all votes cast (with timestamps), final revealed votes, and voting round history
- **FR-026**: System MUST allow multiple participants to use the same name within a session
- **FR-027**: System MUST assign a unique emoji avatar to each participant upon joining to visually differentiate users with identical names
- **FR-028**: System MUST detect when the same browser/device attempts to join a session multiple times (via browser fingerprinting or persistent local storage)
- **FR-029**: System MUST synchronize state across multiple tabs from the same browser/device, treating them as a single participant
- **FR-030**: System MUST prevent creating duplicate participant entries for the same browser/device in a session
- **FR-031**: System MUST enforce a maximum limit of 20 participants per session
- **FR-032**: System MUST reject join attempts when a session has reached 20 participants and display an appropriate error message
- **FR-033**: System MUST automatically reconnect participants who lose network connection to their previous session without requiring manual rejoin
- **FR-034**: System MUST preserve participant identity (name, emoji avatar, moderator status) across reconnections
- **FR-035**: System MUST preserve participant voting state (current vote selection) across reconnections before votes are revealed
- **FR-036**: System MUST handle reconnection transparently without requiring user intervention or re-authentication

### Key Entities

- **Session**: Represents a Planning Poker estimation session. Key attributes include unique session ID, creation timestamp, last activity timestamp, current voting state (voting/revealed), story description, participant count, and expiration status. Sessions expire after 1 hour of inactivity. Each session has multiple participants (maximum 20) and can have multiple moderators.

- **Participant**: Represents a person in a session. Key attributes include name, emoji avatar (randomly assigned for visual differentiation), browser/device identifier, join timestamp, moderator status (boolean, can be promoted/changed), current vote value (null if not voted), and connection status. Each participant belongs to exactly one session. Multiple participants can have the same name but different emoji avatars. Only one participant per browser/device is allowed. Participant identity and state persist across network disconnections for seamless reconnection.

- **Vote**: Represents an estimate cast by a participant. Key attributes include participant identifier, card value (1, 2, 3, 5, 8, 13, 21, or ?), timestamp of vote, and revealed status. Each vote belongs to one participant in one session.

- **Card Deck**: Represents the available voting options. For MVP, this is fixed as Fibonacci sequence (1, 2, 3, 5, 8, 13, 21, ?). In future iterations, could support custom decks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can create a session, copy the link, and share it with team members in under 30 seconds
- **SC-002**: When a participant joins, all existing participants see the join notification within 500ms
- **SC-003**: When a participant votes, all other participants see the vote count update within 500ms
- **SC-004**: When the moderator reveals votes, all participants see all vote values within 500ms
- **SC-005**: The system supports up to 20 concurrent participants in a single session without performance degradation (the maximum allowed)
- **SC-006**: 95% of users can complete their first estimation round (create/join, vote, reveal, reset) without instructions or help
- **SC-007**: The application works on desktop browsers (Chrome, Firefox, Safari, Edge) and mobile browsers (iOS Safari, Chrome Mobile) without feature degradation
- **SC-008**: Sessions remain functional across page refreshes - participants can refresh their browser and return to the same session state
- **SC-009**: The UI clearly distinguishes between moderator and participant roles at all times
- **SC-010**: No vote values are revealed to any participant (including moderator) until the moderator explicitly clicks "Reveal Votes"
- **SC-011**: Sessions expire exactly 1 hour after the last recorded activity (with ±2 minute tolerance for background job execution)
- **SC-012**: Moderators can export session results to Excel format in under 5 seconds, producing a valid .xlsx file that opens in Excel/Google Sheets
- **SC-013**: Each participant is visually distinguishable by their unique emoji avatar, even when multiple participants share the same name
- **SC-014**: Opening the same session link in multiple browser tabs synchronizes state across all tabs as one participant (vote in one tab reflects in all tabs within 500ms)
- **SC-015**: When a session reaches 20 participants, additional join attempts are rejected with a clear, user-friendly error message
- **SC-016**: When a participant loses and regains network connection, they automatically rejoin within 3 seconds with their previous identity and voting state intact
