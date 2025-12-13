import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Moderator Promotion
 *
 * Tests the complete user journey for promoting moderators in a Planning Poker session
 * as defined in Phase 9 - Moderator Management Features
 *
 * Test Scenarios:
 * - Only moderators can see promote buttons
 * - Non-moderator cannot see promote buttons
 * - Promote button is visible only for non-moderator participants
 * - Promote button is not visible for disconnected participants
 * - Manual promotion broadcasts to all participants
 * - Promoted participant receives moderator badge
 * - Promoted participant can promote others
 * - Multiple simultaneous moderators are supported
 * - Toast notifications show on promotion
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

  const nameInput = page.locator('[data-testid="name-input"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill(name);

  const joinButton = page.locator('[data-testid="join-session-btn"]');
  await joinButton.click();

  await expect(page).toHaveURL(`/session/${sessionId}`, { timeout: 5000 });
}

test.describe('Moderator Promotion - E2E', () => {
  test('only moderators see promote buttons', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Moderator creates session
    const sessionId = await createSession(moderatorPage, 'Moderator');

    // Participant joins
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Moderator can see promote button for participant
    const moderatorPromoteBtn = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await expect(moderatorPromoteBtn).toBeVisible({ timeout: 3000 });

    // Participant cannot see promote button for moderator
    const participantPromoteBtn = participantPage.locator('[data-testid="promote-button-moderator"]');
    await expect(participantPromoteBtn).not.toBeVisible();

    await moderatorContext.close();
    await participantContext.close();
  });

  test('promote button not visible for current user', async ({ page }) => {
    // Moderator creates session
    await createSession(page, 'Moderator');

    // Moderator should not see promote button for themselves
    const selfPromoteBtn = page.locator('[data-testid="promote-button-moderator"]');
    await expect(selfPromoteBtn).not.toBeVisible();
  });

  test('promote button not visible for other moderators', async ({ browser }) => {
    const moderator1Context = await browser.newContext();
    const moderator2Context = await browser.newContext();
    const participant1Context = await browser.newContext();

    const moderator1Page = await moderator1Context.newPage();
    const moderator2Page = await moderator2Context.newPage();
    const participant1Page = await participant1Context.newPage();

    // Moderator1 creates session
    const sessionId = await createSession(moderator1Page, 'Moderator1');

    // Moderator2 and Participant1 join
    await joinSession(moderator2Page, sessionId, 'Moderator2');
    await joinSession(participant1Page, sessionId, 'Participant1');
    await moderator1Page.waitForTimeout(1000);

    // Moderator1 promotes Moderator2
    const promoteBtn = moderator1Page.locator('[data-testid="promote-button-moderator2"]');
    await expect(promoteBtn).toBeVisible({ timeout: 3000 });
    await promoteBtn.click();
    await moderator1Page.waitForTimeout(1500);

    // After promotion, Moderator1 should not see promote button for Moderator2 anymore
    await expect(promoteBtn).not.toBeVisible();

    // Moderator2 should see promote button for Participant1 but not for Moderator1
    const mod2ToParticipant1Btn = moderator2Page.locator('[data-testid="promote-button-participant1"]');
    await expect(mod2ToParticipant1Btn).toBeVisible({ timeout: 3000 });

    const mod2ToMod1Btn = moderator2Page.locator('[data-testid="promote-button-moderator1"]');
    await expect(mod2ToMod1Btn).not.toBeVisible();

    await moderator1Context.close();
    await moderator2Context.close();
    await participant1Context.close();
  });

  test('manual promotion broadcasts to all participants', async ({ browser }) => {
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

    // Moderator promotes Participant1
    const promoteBtn = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await expect(promoteBtn).toBeVisible({ timeout: 3000 });
    await promoteBtn.click();

    await moderatorPage.waitForTimeout(1500);

    // Verify Participant1 has moderator badge on all pages
    const modBadgeMod = moderatorPage.locator('[data-testid="participant-item-participant1"] [data-testid="moderator-badge"]');
    await expect(modBadgeMod).toBeVisible({ timeout: 3000 });

    const modBadgeP1 = participant1Page.locator('[data-testid="participant-item-participant1"] [data-testid="moderator-badge"]');
    await expect(modBadgeP1).toBeVisible({ timeout: 3000 });

    const modBadgeP2 = participant2Page.locator('[data-testid="participant-item-participant1"] [data-testid="moderator-badge"]');
    await expect(modBadgeP2).toBeVisible({ timeout: 3000 });

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('promoted participant can promote others', async ({ browser }) => {
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

    // Moderator promotes Participant1
    const promoteBtn = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await expect(promoteBtn).toBeVisible({ timeout: 3000 });
    await promoteBtn.click();
    await moderatorPage.waitForTimeout(1500);

    // Participant1 (now moderator) can promote Participant2
    const participant1PromoteBtn = participant1Page.locator('[data-testid="promote-button-participant2"]');
    await expect(participant1PromoteBtn).toBeVisible({ timeout: 3000 });
    await participant1PromoteBtn.click();
    await moderatorPage.waitForTimeout(1500);

    // Verify Participant2 has moderator badge
    const modBadgeP2 = participant2Page.locator('[data-testid="participant-item-participant2"] [data-testid="moderator-badge"]');
    await expect(modBadgeP2).toBeVisible({ timeout: 3000 });

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('multiple simultaneous moderators are supported', async ({ browser }) => {
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

    // Promote both participants
    const promoteBtn1 = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await promoteBtn1.click();
    await moderatorPage.waitForTimeout(1000);

    const promoteBtn2 = moderatorPage.locator('[data-testid="promote-button-participant2"]');
    await promoteBtn2.click();
    await moderatorPage.waitForTimeout(1500);

    // Verify all three have moderator badges
    const modBadgeMod = moderatorPage.locator('[data-testid="participant-item-moderator"] [data-testid="moderator-badge"]');
    await expect(modBadgeMod).toBeVisible();

    const modBadgeP1 = moderatorPage.locator('[data-testid="participant-item-participant1"] [data-testid="moderator-badge"]');
    await expect(modBadgeP1).toBeVisible();

    const modBadgeP2 = moderatorPage.locator('[data-testid="participant-item-participant2"] [data-testid="moderator-badge"]');
    await expect(modBadgeP2).toBeVisible();

    // Verify all can access moderator controls
    const mod1RevealBtn = moderatorPage.locator('[data-testid="reveal-votes-btn"]');
    await expect(mod1RevealBtn).toBeVisible();

    const mod2RevealBtn = participant1Page.locator('[data-testid="reveal-votes-btn"]');
    await expect(mod2RevealBtn).toBeVisible();

    const mod3RevealBtn = participant2Page.locator('[data-testid="reveal-votes-btn"]');
    await expect(mod3RevealBtn).toBeVisible();

    await moderatorContext.close();
    await participant1Context.close();
    await participant2Context.close();
  });

  test('toast notification shows on promotion', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Create session and add participant
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Moderator promotes Participant1
    const promoteBtn = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await promoteBtn.click();

    // Wait for toast notification to appear (should contain promotion message)
    await moderatorPage.waitForTimeout(500);

    // Both pages should show toast notification
    // Note: Toast messages are in a fixed position at top-right
    const moderatorToast = moderatorPage.locator('.fixed.top-4.right-4 > div');
    await expect(moderatorToast.first()).toBeVisible({ timeout: 3000 });

    const participantToast = participantPage.locator('.fixed.top-4.right-4 > div');
    await expect(participantToast.first()).toBeVisible({ timeout: 3000 });

    await moderatorContext.close();
    await participantContext.close();
  });

  test('promoted participant sees updated moderator status in header', async ({ browser }) => {
    const moderatorContext = await browser.newContext();
    const participantContext = await browser.newContext();

    const moderatorPage = await moderatorContext.newPage();
    const participantPage = await participantContext.newPage();

    // Create session and add participant
    const sessionId = await createSession(moderatorPage, 'Moderator');
    await joinSession(participantPage, sessionId, 'Participant1');
    await moderatorPage.waitForTimeout(1000);

    // Initially, participant should not see moderator badge in header
    const initialModBadge = participantPage.locator('.text-right .bg-yellow-400');
    await expect(initialModBadge).not.toBeVisible();

    // Moderator promotes Participant1
    const promoteBtn = moderatorPage.locator('[data-testid="promote-button-participant1"]');
    await promoteBtn.click();
    await moderatorPage.waitForTimeout(1500);

    // After promotion, participant should see moderator badge in header
    await expect(initialModBadge).toBeVisible({ timeout: 3000 });
    await expect(initialModBadge).toContainText('Moderator');

    await moderatorContext.close();
    await participantContext.close();
  });
});
