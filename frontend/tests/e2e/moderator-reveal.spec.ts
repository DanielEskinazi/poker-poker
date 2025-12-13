import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Moderator Reveal Flow
 *
 * Tests the complete user journey for revealing votes in a Planning Poker session
 * as defined in User Story 4 (US4) - Moderator Reveal & Statistics
 *
 * Test Scenarios:
 * - Only moderator can see reveal button
 * - Non-moderator cannot reveal votes
 * - Reveal button enabled only when votes exist
 * - Reveal shows all votes with statistics
 * - Statistics include consensus, average, distribution
 * - Cannot reveal twice without reset
 */

/**
 * Helper: Create a session and return session ID
 */
async function createSession(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.locator('[data-testid="name-input"]').fill(name);
  await page.locator('[data-testid="create-session-btn"]').click();
  await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

  const url = page.url();
  const sessionId = url.match(/\/session\/([A-Za-z0-9]{8})/)?.[1];
  expect(sessionId).toBeDefined();
  return sessionId!;
}

/**
 * Helper: Join an existing session
 */
async function joinSession(page: Page, sessionId: string, name: string): Promise<void> {
  await page.goto(`/session/${sessionId}`);

  const nameInput = page.locator('[data-testid="join-name-input"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill(name);

  const joinButton = page.locator('[data-testid="join-session-btn"]');
  await joinButton.click();

  await expect(page).toHaveURL(`/session/${sessionId}`, { timeout: 5000 });
}

test.describe('Moderator Reveal - E2E', () => {
  test('only moderator sees reveal button', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant joins
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Moderator can see reveal button
    const moderatorRevealBtn = moderatorPage.locator('[data-testid="reveal-votes-btn"]');
    await expect(moderatorRevealBtn).toBeVisible();

    // Participant cannot see reveal button
    const participantRevealBtn = participantPage.locator('[data-testid="reveal-votes-btn"]');
    await expect(participantRevealBtn).not.toBeVisible();

    await moderatorContext.close();
    await participantContext.close();
  });

  test('reveal button is disabled when no votes exist', async ({ page }) => {
    // Moderator creates session
    await createSession(page, 'Moderator');

    // Verify reveal button exists but is disabled
    const revealBtn = page.locator('[data-testid="reveal-votes-btn"]');
    await expect(revealBtn).toBeVisible();
    await expect(revealBtn).toBeDisabled();
  });

  test('reveal button is enabled when at least one vote exists', async ({ page }) => {
    // Moderator creates session
    await createSession(page, 'Moderator');

    // Initially disabled
    const revealBtn = page.locator('[data-testid="reveal-votes-btn"]');
    await expect(revealBtn).toBeDisabled();

    // Moderator votes
    await page.locator('[data-testid="card-5"]').click();
    await page.waitForTimeout(500);

    // Now enabled
    await expect(revealBtn).toBeEnabled({ timeout: 3000 });
  });

  test('reveal shows all participant votes', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Create session and add participants
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // All vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participant1Page.locator('[data-testid="card-8"]').click();
    await participant2Page.locator('[data-testid="card-5"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Moderator reveals
    const revealBtn = moderatorPage.locator('[data-testid="reveal-votes-btn"]');
    await revealBtn.click();

    // Verify revealed votes are visible for all participants
    await moderatorPage.waitForTimeout(1000);

    // Check moderator view
    const modRevealedVotes = moderatorPage.locator('[data-testid="revealed-votes"]');
    await expect(modRevealedVotes).toBeVisible({ timeout: 3000 });

    // Verify all three votes are shown
    const modVoteValues = moderatorPage.locator('[data-testid="participant-vote-value"]');
    await expect(modVoteValues).toHaveCount(3, { timeout: 3000 });

    // Check participant views
    const part1RevealedVotes = participant1Page.locator('[data-testid="revealed-votes"]');
    await expect(part1RevealedVotes).toBeVisible({ timeout: 3000 });

    const part2RevealedVotes = participant2Page.locator('[data-testid="revealed-votes"]');
    await expect(part2RevealedVotes).toBeVisible({ timeout: 3000 });

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('reveal shows statistics with consensus', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Create session and add participants
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // All vote the same value (consensus)
    await moderatorPage.locator('[data-testid="card-8"]').click();
    await participant1Page.locator('[data-testid="card-8"]').click();
    await participant2Page.locator('[data-testid="card-8"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify consensus indicator is shown
    const consensusIndicator = moderatorPage.locator('[data-testid="consensus-indicator"]');
    await expect(consensusIndicator).toBeVisible({ timeout: 3000 });

    // Verify average is 8
    const averageDisplay = moderatorPage.locator('[data-testid="average-display"]');
    await expect(averageDisplay).toContainText('8');

    // Verify distribution shows 100% voted 8
    const distributionDisplay = moderatorPage.locator('[data-testid="distribution-display"]');
    await expect(distributionDisplay).toBeVisible();

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('reveal shows statistics without consensus', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Create session and add participants
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // Vote different values (no consensus)
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participant1Page.locator('[data-testid="card-8"]').click();
    await participant2Page.locator('[data-testid="card-13"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify no consensus indicator
    const consensusIndicator = moderatorPage.locator('[data-testid="consensus-indicator"]');
    await expect(consensusIndicator).not.toBeVisible();

    // Verify average is calculated (5+8+13)/3 ≈ 8.67
    const averageDisplay = moderatorPage.locator('[data-testid="average-display"]');
    await expect(averageDisplay).toBeVisible();
    const avgText = await averageDisplay.textContent();
    expect(avgText).toContain('8.'); // Should be around 8.67

    // Verify distribution shows all three values
    const distributionDisplay = moderatorPage.locator('[data-testid="distribution-display"]');
    await expect(distributionDisplay).toBeVisible();

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('reveal handles question mark votes correctly', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Create session and add participant
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Moderator votes 5, participant votes ?
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-question"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify both votes are shown
    const voteValues = moderatorPage.locator('[data-testid="participant-vote-value"]');
    await expect(voteValues).toHaveCount(2, { timeout: 3000 });

    // Verify ? is shown in votes
    const questionVote = moderatorPage.locator('[data-testid="participant-vote-value"]', { hasText: '?' });
    await expect(questionVote).toBeVisible();

    // Verify average excludes ? (should be 5)
    const averageDisplay = moderatorPage.locator('[data-testid="average-display"]');
    await expect(averageDisplay).toContainText('5');

    await moderatorContext.close();
    await participantContext.close();
  });

  test('cannot reveal twice without reset', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Create session and add participant
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Reveal once
    const revealBtn = moderatorPage.locator('[data-testid="reveal-votes-btn"]');
    await revealBtn.click();
    await moderatorPage.waitForTimeout(1000);

    // Verify reveal button is now disabled or hidden
    await expect(revealBtn).toBeDisabled({ timeout: 3000 });

    await moderatorContext.close();
    await participantContext.close();
  });

  test('all participants see revealed votes simultaneously', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Create session and add participants
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // All vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participant1Page.locator('[data-testid="card-8"]').click();
    await participant2Page.locator('[data-testid="card-13"]').click();

    await moderatorPage.waitForTimeout(1000);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();

    // All participants should see revealed votes within 2 seconds
    await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).toBeVisible({ timeout: 2000 });
    await expect(participant1Page.locator('[data-testid="revealed-votes"]')).toBeVisible({ timeout: 2000 });
    await expect(participant2Page.locator('[data-testid="revealed-votes"]')).toBeVisible({ timeout: 2000 });

    // Verify all see the same vote count
    const modVotes = moderatorPage.locator('[data-testid="participant-vote-value"]');
    const p1Votes = participant1Page.locator('[data-testid="participant-vote-value"]');
    const p2Votes = participant2Page.locator('[data-testid="participant-vote-value"]');

    await expect(modVotes).toHaveCount(3);
    await expect(p1Votes).toHaveCount(3);
    await expect(p2Votes).toHaveCount(3);

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('cards remain disabled after reveal', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Create session and add participant
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await moderatorPage.waitForTimeout(500);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Try to vote again (should be disabled)
    const card8 = moderatorPage.locator('[data-testid="card-8"]');
    await expect(card8).toBeDisabled({ timeout: 3000 });

    // Participant also cannot vote after reveal
    const partCard = participantPage.locator('[data-testid="card-8"]');
    await expect(partCard).toBeDisabled({ timeout: 3000 });

    await moderatorContext.close();
    await participantContext.close();
  });
});
