import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Session Creation Flow
 *
 * Tests the complete user journey for creating a Planning Poker session
 * as defined in User Story 1 (US1) - Session Creation & Link Sharing
 *
 * Test Scenario from quickstart.md:
 * - Open app
 * - Create session
 * - Verify unique URL generated
 * - Copy link to clipboard
 *
 * TDD Approach: These tests are written FIRST and should FAIL until
 * the implementation is complete.
 */

test.describe('Session Creation Flow - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page before each test
    await page.goto('/');
  });

  test('user can create a new session with valid name', async ({ page }) => {
    // Step 1: Verify home page loads correctly
    await expect(page).toHaveURL('/');

    // Step 2: Verify create session form is visible
    const nameInput = page.locator('[data-testid="name-input"]');
    const createButton = page.locator('[data-testid="create-session-btn"]');

    await expect(nameInput).toBeVisible();
    await expect(createButton).toBeVisible();

    // Step 3: Enter name
    await nameInput.fill('Sarah');

    // Step 4: Click create session button
    await createButton.click();

    // Step 5: Verify redirected to session page with valid session ID
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Step 6: Extract and verify session ID format
    const currentUrl = page.url();
    const sessionIdMatch = currentUrl.match(/\/session\/([A-Za-z0-9]{8})/);
    expect(sessionIdMatch).toBeTruthy();
    expect(sessionIdMatch![1]).toMatch(/^[A-Za-z0-9]{8}$/);
  });

  test('user sees moderator badge after creating session', async ({ page }) => {
    // Create session
    await page.locator('[data-testid="name-input"]').fill('Moderator');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect to session page
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Verify moderator badge is visible
    const moderatorBadge = page.locator('[data-testid="moderator-badge"]');
    await expect(moderatorBadge).toBeVisible({ timeout: 3000 });
  });

  test('user can copy session link to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Create session
    await page.locator('[data-testid="name-input"]').fill('Alice');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Get current URL for verification
    const sessionUrl = page.url();

    // Click copy link button
    const copyButton = page.locator('[data-testid="copy-link-btn"]');
    await expect(copyButton).toBeVisible();
    await copyButton.click();

    // Verify clipboard contains the session URL
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toContain('/session/');
    expect(clipboardText).toContain(sessionUrl.split('/session/')[1]);

    // Verify success toast/feedback appears
    const successToast = page.locator('[data-testid="copy-success-toast"]');
    await expect(successToast).toBeVisible({ timeout: 2000 });
  });

  test('user sees emoji avatar after creating session', async ({ page }) => {
    // Create session
    await page.locator('[data-testid="name-input"]').fill('Bob');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Verify emoji is displayed in participant list
    const participantEmoji = page.locator('[data-testid="participant-emoji"]');
    await expect(participantEmoji).toBeVisible();

    // Verify it contains an emoji character
    const emojiText = await participantEmoji.textContent();
    expect(emojiText).toBeTruthy();
    expect(emojiText!.length).toBeGreaterThan(0);
  });

  test('session creation fails with empty name', async ({ page }) => {
    // Try to create session without entering name
    const createButton = page.locator('[data-testid="create-session-btn"]');
    await createButton.click();

    // Verify error message is displayed
    const errorMessage = page.locator('[data-testid="name-error"]');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
    await expect(errorMessage).toContainText(/required|1-50 characters/i);

    // Verify still on home page (not redirected)
    await expect(page).toHaveURL('/');
  });

  test('session creation fails with name too long', async ({ page }) => {
    // Enter name with 51 characters
    const longName = 'a'.repeat(51);
    await page.locator('[data-testid="name-input"]').fill(longName);
    await page.locator('[data-testid="create-session-btn"]').click();

    // Verify error message is displayed
    const errorMessage = page.locator('[data-testid="name-error"]');
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
    await expect(errorMessage).toContainText(/1-50 characters|too long/i);

    // Verify still on home page
    await expect(page).toHaveURL('/');
  });

  test('session ID is unique across multiple creations', async ({ page, browser }) => {
    const sessionIds: string[] = [];

    // Create first session
    await page.locator('[data-testid="name-input"]').fill('User1');
    await page.locator('[data-testid="create-session-btn"]').click();
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/);

    const url1 = page.url();
    const sessionId1 = url1.match(/\/session\/([A-Za-z0-9]{8})/)?.[1];
    expect(sessionId1).toBeDefined();
    sessionIds.push(sessionId1!);

    // Create second session in new context
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/');
    await page2.locator('[data-testid="name-input"]').fill('User2');
    await page2.locator('[data-testid="create-session-btn"]').click();
    await expect(page2).toHaveURL(/\/session\/[A-Za-z0-9]{8}/);

    const url2 = page2.url();
    const sessionId2 = url2.match(/\/session\/([A-Za-z0-9]{8})/)?.[1];
    expect(sessionId2).toBeDefined();
    sessionIds.push(sessionId2!);

    // Verify session IDs are different
    expect(sessionIds[0]).not.toBe(sessionIds[1]);

    await context2.close();
  });

  test('XSS attack in name is sanitized', async ({ page }) => {
    // Try to create session with XSS payload
    await page.locator('[data-testid="name-input"]').fill('<script>alert("XSS")</script>Bob');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Verify participant name is sanitized (no script tags)
    const participantName = page.locator('[data-testid="participant-name"]');
    await expect(participantName).toBeVisible();

    const nameText = await participantName.textContent();
    expect(nameText).not.toContain('<script>');
    expect(nameText).not.toContain('</script>');
    expect(nameText).toContain('Bob');
  });

  test('session page shows initial state correctly', async ({ page }) => {
    // Create session
    await page.locator('[data-testid="name-input"]').fill('Host');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Verify initial session state
    // - Participant count should be 1
    const participantCount = page.locator('[data-testid="participant-count"]');
    await expect(participantCount).toContainText('1');

    // - Vote counter should show 0 of 1 voted
    const voteCounter = page.locator('[data-testid="vote-counter"]');
    await expect(voteCounter).toContainText('0 of 1');

    // - Card deck should be visible
    const cardDeck = page.locator('[data-testid="card-deck"]');
    await expect(cardDeck).toBeVisible();

    // - Moderator controls should be visible
    const moderatorControls = page.locator('[data-testid="moderator-controls"]');
    await expect(moderatorControls).toBeVisible();
  });

  test('session URL structure is correct', async ({ page }) => {
    // Create session
    await page.locator('[data-testid="name-input"]').fill('URLTest');
    await page.locator('[data-testid="create-session-btn"]').click();

    // Wait for redirect
    await expect(page).toHaveURL(/\/session\/[A-Za-z0-9]{8}/, { timeout: 5000 });

    // Verify URL structure
    const currentUrl = page.url();

    // Should match pattern: http(s)://domain/session/{8-char-id}
    expect(currentUrl).toMatch(/^https?:\/\/.+\/session\/[A-Za-z0-9]{8}$/);

    // Session ID should be exactly 8 characters
    const sessionId = currentUrl.split('/session/')[1];
    expect(sessionId.length).toBe(8);

    // Session ID should only contain alphanumeric characters
    expect(sessionId).toMatch(/^[A-Za-z0-9]+$/);
  });
});

test.describe('Session Creation - Multiple Browsers', () => {
  test('different browsers create different sessions', async ({ browser }) => {
    // Create two separate browser contexts (simulating different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // User 1 creates session
    await page1.goto('/');
    await page1.locator('[data-testid="name-input"]').fill('User1');
    await page1.locator('[data-testid="create-session-btn"]').click();
    await expect(page1).toHaveURL(/\/session\/[A-Za-z0-9]{8}/);
    const sessionId1 = page1.url().match(/\/session\/([A-Za-z0-9]{8})/)?.[1];

    // User 2 creates session
    await page2.goto('/');
    await page2.locator('[data-testid="name-input"]').fill('User2');
    await page2.locator('[data-testid="create-session-btn"]').click();
    await expect(page2).toHaveURL(/\/session\/[A-Za-z0-9]{8}/);
    const sessionId2 = page2.url().match(/\/session\/([A-Za-z0-9]{8})/)?.[1];

    // Verify different session IDs
    expect(sessionId1).toBeDefined();
    expect(sessionId2).toBeDefined();
    expect(sessionId1).not.toBe(sessionId2);

    await context1.close();
    await context2.close();
  });
});
