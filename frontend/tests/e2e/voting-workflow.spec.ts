import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Voting Workflow
 *
 * Tests the complete user journey for voting in a Planning Poker session
 * as defined in User Story 3 (US3) - Anonymous Voting
 *
 * Test Scenarios:
 * - Participants can select cards to vote
 * - Vote count updates correctly
 * - Votes remain hidden before reveal
 * - Participants can change their vote
 * - Vote counter shows accurate count
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

  // Fill in name on join page
  const nameInput = page.locator('[data-testid="join-name-input"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill(name);

  const joinButton = page.locator('[data-testid="join-session-btn"]');
  await joinButton.click();

  // Wait for successful join
  await expect(page).toHaveURL(`/session/${sessionId}`, { timeout: 5000 });
}

test.describe('Voting Workflow - E2E', () => {
  test('participant can select a card to vote', async ({ page }) => {
    // Create session
    await createSession(page, 'Alice');

    // Verify card deck is visible
    const cardDeck = page.locator('[data-testid="card-deck"]');
    await expect(cardDeck).toBeVisible();

    // Select a card (value 5)
    const card5 = page.locator('[data-testid="card-5"]');
    await expect(card5).toBeVisible();
    await card5.click();

    // Verify card is marked as selected
    await expect(card5).toHaveAttribute('data-selected', 'true', { timeout: 2000 });

    // Verify vote counter updates
    const voteCounter = page.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('1 of 1', { timeout: 3000 });
  });

  test('participant can change their vote before reveal', async ({ page }) => {
    // Create session
    await createSession(page, 'Bob');

    // Select first card (value 3)
    const card3 = page.locator('[data-testid="card-3"]');
    await card3.click();
    await expect(card3).toHaveAttribute('data-selected', 'true');

    // Wait a moment
    await page.waitForTimeout(500);

    // Change vote to different card (value 8)
    const card8 = page.locator('[data-testid="card-8"]');
    await card8.click();

    // Verify new card is selected
    await expect(card8).toHaveAttribute('data-selected', 'true', { timeout: 2000 });

    // Verify old card is not selected
    await expect(card3).not.toHaveAttribute('data-selected', 'true');

    // Verify vote count remains 1
    const voteCounter = page.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('1 of 1');
  });

  test('vote counter updates correctly with multiple participants', async ({ browser }) => {
    // Create two browser contexts
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant joins session
    await joinSession(participantPage, sessionId, 'Participant1');

    // Wait for participant to appear in moderator's view
    await moderatorPage.waitForTimeout(1000);

    // Verify initial vote count is 0 of 2
    const modVoteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
    await expect(modVoteCounter).toContainText('0 of 2', { timeout: 3000 });

    // Moderator votes
    await moderatorPage.locator('[data-testid="card-5"]').click();

    // Verify vote count updates to 1 of 2 for both users
    await expect(modVoteCounter).toContainText('1 of 2', { timeout: 3000 });

    const partVoteCounter = participantPage.locator('[data-testid="vote-counter"]');
    await expect(partVoteCounter).toContainText('1 of 2', { timeout: 3000 });

    // Participant votes
    await participantPage.locator('[data-testid="card-8"]').click();

    // Verify vote count updates to 2 of 2 for both users
    await expect(modVoteCounter).toContainText('2 of 2', { timeout: 3000 });
    await expect(partVoteCounter).toContainText('2 of 2', { timeout: 3000 });

    await moderatorContext.close();
    await participantContext.close();
  });

  test('votes remain hidden before reveal', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant joins
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Both vote
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await participantPage.locator('[data-testid="card-8"]').click();

    // Wait for votes to register
    await moderatorPage.waitForTimeout(1000);

    // Verify vote VALUES are not visible (only vote count)
    const moderatorVoteValue = moderatorPage.locator('[data-testid="participant-vote-value"]');
    await expect(moderatorVoteValue).not.toBeVisible();

    const participantVoteValue = participantPage.locator('[data-testid="participant-vote-value"]');
    await expect(participantVoteValue).not.toBeVisible();

    // Verify vote counter shows count but not values
    const voteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('2 of 2');
    await expect(voteCounter).not.toContainText('5');
    await expect(voteCounter).not.toContainText('8');

    await moderatorContext.close();
    await participantContext.close();
  });

  test('participant can vote with question mark card', async ({ page }) => {
    // Create session
    await createSession(page, 'Charlie');

    // Select question mark card
    const cardQuestion = page.locator('[data-testid="card-question"]');
    await expect(cardQuestion).toBeVisible();
    await cardQuestion.click();

    // Verify card is selected
    await expect(cardQuestion).toHaveAttribute('data-selected', 'true', { timeout: 2000 });

    // Verify vote counter updates
    const voteCounter = page.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('1 of 1');
  });

  test('all Fibonacci cards are available', async ({ page }) => {
    // Create session
    await createSession(page, 'Diana');

    // Verify all Fibonacci sequence cards are visible
    const expectedCards = ['1', '2', '3', '5', '8', '13', '21', 'question'];

    for (const cardValue of expectedCards) {
      const card = page.locator(`[data-testid="card-${cardValue}"]`);
      await expect(card).toBeVisible();
    }
  });

  test('vote indication shows in participant list', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant joins
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Initially, no vote indicators
    const modVoteIndicator = moderatorPage.locator('[data-testid="participant-voted-indicator"]').first();
    await expect(modVoteIndicator).not.toBeVisible();

    // Moderator votes
    await moderatorPage.locator('[data-testid="card-5"]').click();
    await moderatorPage.waitForTimeout(500);

    // Verify vote indicator appears for moderator in both views
    await expect(modVoteIndicator).toBeVisible({ timeout: 3000 });

    const partVoteIndicator = participantPage.locator('[data-testid="participant-voted-indicator"]').first();
    await expect(partVoteIndicator).toBeVisible({ timeout: 3000 });

    await moderatorContext.close();
    await participantContext.close();
  });

  test('participant can vote after joining mid-session', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participant1Context = await browser.newContext();
    const participant2Context = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participant1Page = await participant1Context.newPage();
    const participant2Page = await participant2Context.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant 1 joins and votes
    await joinSession(participant1Page, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);
    await participant1Page.locator('[data-testid="card-3"]').click();

    // Verify vote counter: 1 of 2
    const voteCounter = moderatorPage.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('1 of 2', { timeout: 3000 });

    // Participant 2 joins late
    await joinSession(participant2Page, sessionId, 'Participant2');
    await moderatorPage.waitForTimeout(1000);

    // Verify vote counter updates to show 1 of 3
    await expect(voteCounter).toContainText('1 of 3', { timeout: 3000 });

    // Participant 2 can vote
    await participant2Page.locator('[data-testid="card-8"]').click();

    // Verify vote counter updates to 2 of 3
    await expect(voteCounter).toContainText('2 of 3', { timeout: 3000 });

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('selected card is visually highlighted', async ({ page }) => {
    // Create session
    await createSession(page, 'Eve');

    // Select card
    const card5 = page.locator('[data-testid="card-5"]');

    // Get initial state
    const initialClass = await card5.getAttribute('class');

    // Click card
    await card5.click();
    await page.waitForTimeout(500);

    // Verify class changed (indicating visual highlight)
    const selectedClass = await card5.getAttribute('class');
    expect(selectedClass).not.toBe(initialClass);
    expect(selectedClass).toContain('selected');
  });
});
