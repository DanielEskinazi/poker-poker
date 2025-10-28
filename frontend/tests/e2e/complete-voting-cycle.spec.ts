import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Complete Voting Cycle
 *
 * Tests the complete user journey for a full voting cycle in Planning Poker
 * as defined in User Story 5 (US5) - Reset for New Round
 *
 * Test Scenarios:
 * - Complete cycle: vote → reveal → reset → new vote
 * - Reset clears all votes and statistics
 * - Reset allows participants to vote again
 * - Multiple consecutive rounds work correctly
 * - Session state is maintained across rounds
 * - Only moderator can reset
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

test.describe('Complete Voting Cycle - E2E', () => {
  test('complete flow: vote → reveal → reset → new vote', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Setup session
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // ROUND 1: Vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify vote counter
    const voteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('2 of 2', { timeout: 3000 });

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify revealed
    await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).toBeVisible();
    await expect(participantPage.locator('[data-testid="revealed-votes"]')).toBeVisible();

    // Reset
    const resetBtn = moderatorPage.locator('[data-testid="reset-votes-btn"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();
    await moderatorPage.waitForTimeout(1000);

    // ROUND 2: Verify state is cleared
    await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).not.toBeVisible();
    await expect(participantPage.locator('[data-testid="revealed-votes"]')).not.toBeVisible();

    // Verify vote counter reset
    await expect(voteCounter).toContainText('0 of 2', { timeout: 3000 });

    // Verify cards are enabled again
    const modCard13 = moderatorPage.locator('[data-testid="card-13"]');
    await expect(modCard13).toBeEnabled();

    // Vote again with different values
    await moderatorPage.locator('[data-testid="card-13"]').click();
    await participantPage.locator('[data-testid="card-21"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify new vote counter
    await expect(voteCounter).toContainText('2 of 2');

    // Reveal again
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify new votes are shown (not old ones)
    await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).toBeVisible();

    // Verify vote values are the new ones
    const voteValues = await moderatorPage.locator('[data-testid="participant-vote-value"]').allTextContents();
    expect(voteValues).toContain('13');
    expect(voteValues).toContain('21');
    expect(voteValues).not.toContain('5');
    expect(voteValues).not.toContain('8');

    await moderatorContext.close();
    await participantContext.close();
  });

  test('only moderator can see reset button', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Setup session
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Vote and reveal
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();
    await moderatorPage.waitForTimeout(1000);

    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Moderator can see reset button
    const moderatorResetBtn = moderatorPage.locator('[data-testid="reset-votes-btn"]');
    await expect(moderatorResetBtn).toBeVisible();

    // Participant cannot see reset button
    const participantResetBtn = participantPage.locator('[data-testid="reset-votes-btn"]');
    await expect(participantResetBtn).not.toBeVisible();

    await moderatorContext.close();
    await participantContext.close();
  });

  test('reset button only visible after reveal', async ({ page }) => {
    // Create session
    await createSession(page, 'Moderator');

    // Reset button not visible initially
    const resetBtn = page.locator('[data-testid="reset-votes-btn"]');
    await expect(resetBtn).not.toBeVisible();

    // Vote
    await page.locator('[data-testid="card-5"]').click();
    await page.waitForTimeout(500);

    // Still not visible
    await expect(resetBtn).not.toBeVisible();

    // Reveal
    await page.locator('[data-testid="reveal-votes-btn"]').click();
    await page.waitForTimeout(1000);

    // Now visible
    await expect(resetBtn).toBeVisible({ timeout: 3000 });
  });

  test('multiple consecutive rounds preserve session', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Setup session
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Run 3 consecutive rounds
    const rounds = [
      { mod: '3', part: '5' },
      { mod: '8', part: '8' },  // Consensus round
      { mod: '13', part: '21' }
    ];

    for (let i = 0; i < rounds.length; i++) {
      const round = rounds[i];

      // Vote
      await moderatorPage.locator(`[data-testid="card-${round.mod}"]`).click();
      await participantPage.locator(`[data-testid="card-${round.part}"]`).click();
      await moderatorPage.waitForTimeout(1000);

      // Verify vote counter
      const voteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
      await expect(voteCounter).toContainText('2 of 2');

      // Reveal
      await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
      await moderatorPage.waitForTimeout(1000);

      // Verify revealed
      await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).toBeVisible();

      // If consensus round, verify consensus indicator
      if (i === 1) {
        const consensusIndicator = moderatorPage.locator('[data-testid="consensus-indicator"]');
        await expect(consensusIndicator).toBeVisible();
      }

      // Reset (except last round)
      if (i < rounds.length - 1) {
        await moderatorPage.locator('[data-testid="reset-votes-btn"]').click();
        await moderatorPage.waitForTimeout(1000);

        // Verify reset
        await expect(moderatorPage.locator('[data-testid="revealed-votes"]')).not.toBeVisible();
      }
    }

    // Verify session still intact (participants still connected)
    const participantCount = moderatorPage.locator('[data-testid="participant-count"]');
    await expect(participantCount).toContainText('2');

    await moderatorContext.close();
    await participantContext.close();
  });

  test('reset clears selected cards for all participants', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Setup session
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();
    await moderatorPage.waitForTimeout(500);

    // Verify cards are selected
    await expect(moderatorPage.locator('[data-testid="card-5"]')).toHaveAttribute('data-selected', 'true');
    await expect(participantPage.locator('[data-testid="card-8"]')).toHaveAttribute('data-selected', 'true');

    // Reveal and reset
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);
    await moderatorPage.locator('[data-testid="reset-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify cards are no longer selected
    await expect(moderatorPage.locator('[data-testid="card-5"]')).not.toHaveAttribute('data-selected', 'true');
    await expect(participantPage.locator('[data-testid="card-8"]')).not.toHaveAttribute('data-selected', 'true');

    await moderatorContext.close();
    await participantContext.close();
  });

  test('reset clears statistics', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Setup session
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Reveal
    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify statistics are shown
    await expect(moderatorPage.locator('[data-testid="average-display"]')).toBeVisible();
    await expect(moderatorPage.locator('[data-testid="distribution-display"]')).toBeVisible();

    // Reset
    await moderatorPage.locator('[data-testid="reset-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // Verify statistics are cleared
    await expect(moderatorPage.locator('[data-testid="average-display"]')).not.toBeVisible();
    await expect(moderatorPage.locator('[data-testid="distribution-display"]')).not.toBeVisible();

    await moderatorContext.close();
    await participantContext.close();
  });

  test('participant joining after reset can vote', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Setup session with 2 participants
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Round 1: Vote, reveal, reset
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participant1Page.locator('[data-testid="card-8"]').click();
    await moderatorPage.waitForTimeout(1000);

    await moderatorPage.locator('[data-testid="reveal-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    await moderatorPage.locator('[data-testid="reset-votes-btn"]').click();
    await moderatorPage.waitForTimeout(1000);

    // New participant joins after reset
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // Verify vote counter shows 0 of 3
    const voteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('0 of 3', { timeout: 3000 });

    // New participant can vote
    await participant2Page.locator('[data-testid="card-13"]').click();
    await moderatorPage.waitForTimeout(500);

    // Verify vote counter updates
    await expect(voteCounter).toContainText('1 of 3');

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('reveal and reset buttons toggle correctly', async ({ page }) => {
    // Create session
    await createSession(page, 'Moderator');

    const revealBtn = page.locator('[data-testid="reveal-votes-btn"]');
    const resetBtn = page.locator('[data-testid="reset-votes-btn"]');

    // Initially: reveal disabled, reset hidden
    await expect(revealBtn).toBeDisabled();
    await expect(resetBtn).not.toBeVisible();

    // After voting: reveal enabled, reset still hidden
    await page.locator('[data-testid="card-5"]').click();
    await page.waitForTimeout(500);

    await expect(revealBtn).toBeEnabled();
    await expect(resetBtn).not.toBeVisible();

    // After revealing: reveal disabled, reset visible
    await revealBtn.click();
    await page.waitForTimeout(1000);

    await expect(revealBtn).toBeDisabled();
    await expect(resetBtn).toBeVisible();

    // After resetting: reveal disabled (no votes), reset hidden
    await resetBtn.click();
    await page.waitForTimeout(1000);

    await expect(revealBtn).toBeDisabled();
    await expect(resetBtn).not.toBeVisible();
  });

  test('session maintains moderator across rounds', async ({ page }) => {
    // Create session
    await createSession(page, 'Moderator');

    // Verify moderator badge
    const moderatorBadge = page.locator('[data-testid="moderator-badge"]');
    await expect(moderatorBadge).toBeVisible();

    // Run through 2 complete rounds
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-testid="card-5"]').click();
      await page.waitForTimeout(500);

      await page.locator('[data-testid="reveal-votes-btn"]').click();
      await page.waitForTimeout(1000);

      // Verify still moderator
      await expect(moderatorBadge).toBeVisible();
      await expect(page.locator('[data-testid="reset-votes-btn"]')).toBeVisible();

      if (i < 1) {
        await page.locator('[data-testid="reset-votes-btn"]').click();
        await page.waitForTimeout(1000);

        // Still moderator after reset
        await expect(moderatorBadge).toBeVisible();
      }
    }
  });
});
