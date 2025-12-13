import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Participant Status Indicators
 *
 * Tests participant list UI showing:
 * - Voting status indicators (checkmarks when voted)
 * - Connection status (online/offline)
 * - Visual feedback for participant states
 *
 * Success Criteria:
 * - Participant list shows checkmarks next to participants who have voted
 * - Voting status updates in real-time for all participants
 * - Connection status indicators show online/offline state
 */

test.describe('Participant Status Indicators', () => {
  let moderatorPage: Page;
  let participant1Page: Page;
  let participant2Page: Page;
  let sessionId: string;

  test.beforeEach(async ({ browser }) => {
    // Create three browser contexts for different participants
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    moderatorPage = await context1.newPage();
    participant1Page = await context2.newPage();
    participant2Page = await context3.newPage();

    // Moderator creates session
    await moderatorPage.goto('http://localhost:5173');
    await moderatorPage.fill('[data-testid="name-input"]', 'Alice');
    await moderatorPage.click('[data-testid="create-session-btn"]');

    // Wait for redirect to session page
    await moderatorPage.waitForURL(/\/session\/.+/);

    // Extract session ID from URL
    const url = moderatorPage.url();
    sessionId = url.split('/session/')[1];
    expect(sessionId).toBeTruthy();
  });

  test.afterEach(async () => {
    await moderatorPage.close();
    await participant1Page.close();
    await participant2Page.close();
  });

  test('should show checkmarks next to participants who have voted', async () => {
    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Participant 2 joins
    await participant2Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant2Page.fill('[data-testid="name-input"]', 'Charlie');
    await participant2Page.click('[data-testid="join-session-btn"]');
    await participant2Page.waitForSelector('text=Charlie', { timeout: 5000 });

    // Initially, no one has voted - no checkmarks should be visible
    await expect(moderatorPage.locator('[data-testid="participant-voted-alice"]')).not.toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).not.toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-charlie"]')).not.toBeVisible();

    // Bob votes
    await participant1Page.click('[data-testid="card-5"]');

    // Wait a moment for state to propagate
    await moderatorPage.waitForTimeout(500);

    // Bob should have a checkmark on all pages
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).toBeVisible();
    await expect(participant2Page.locator('[data-testid="participant-voted-bob"]')).toBeVisible();

    // Alice and Charlie should still not have checkmarks
    await expect(moderatorPage.locator('[data-testid="participant-voted-alice"]')).not.toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-charlie"]')).not.toBeVisible();

    // Charlie votes
    await participant2Page.click('[data-testid="card-8"]');
    await moderatorPage.waitForTimeout(500);

    // Both Bob and Charlie should have checkmarks
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-charlie"]')).toBeVisible();

    // Alice (moderator) votes
    await moderatorPage.click('[data-testid="card-3"]');
    await moderatorPage.waitForTimeout(500);

    // All three should have checkmarks
    await expect(moderatorPage.locator('[data-testid="participant-voted-alice"]')).toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-charlie"]')).toBeVisible();
  });

  test('should clear voting status indicators after reset', async () => {
    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Both participants vote
    await moderatorPage.click('[data-testid="card-5"]');
    await participant1Page.click('[data-testid="card-8"]');
    await moderatorPage.waitForTimeout(500);

    // Verify both have checkmarks
    await expect(moderatorPage.locator('[data-testid="participant-voted-alice"]')).toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).toBeVisible();

    // Moderator reveals votes
    await moderatorPage.click('button:has-text("Reveal Votes")');
    await moderatorPage.waitForTimeout(500);

    // Moderator resets votes
    await moderatorPage.click('button:has-text("Reset Votes")');
    await moderatorPage.waitForTimeout(500);

    // Checkmarks should be cleared
    await expect(moderatorPage.locator('[data-testid="participant-voted-alice"]')).not.toBeVisible();
    await expect(moderatorPage.locator('[data-testid="participant-voted-bob"]')).not.toBeVisible();
    await expect(participant1Page.locator('[data-testid="participant-voted-alice"]')).not.toBeVisible();
    await expect(participant1Page.locator('[data-testid="participant-voted-bob"]')).not.toBeVisible();
  });

  test('should show connection status indicators', async () => {
    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Both participants should show as online/connected
    await expect(moderatorPage.locator('[data-testid="participant-status-alice"]')).toHaveText('online');
    await expect(moderatorPage.locator('[data-testid="participant-status-bob"]')).toHaveText('online');

    // Note: Testing disconnect/offline status would require simulating network disconnection
    // This is typically done with browser context offline mode or closing the page
    // For a complete test, we might add:

    // Close Bob's page to simulate disconnect
    await participant1Page.close();

    // Wait for disconnect to be detected (after grace period or immediately)
    await moderatorPage.waitForTimeout(2000);

    // Bob should be removed from participants list or show as offline
    // The exact behavior depends on implementation (immediate removal vs. grace period)
    const bobElement = moderatorPage.locator('text=Bob');
    const isVisible = await bobElement.isVisible();

    if (isVisible) {
      // If still visible, should show as offline
      await expect(moderatorPage.locator('[data-testid="participant-status-bob"]')).toHaveText('offline');
    } else {
      // If not visible, Bob was removed from the list
      expect(isVisible).toBe(false);
    }
  });

  test('should update participant count dynamically', async () => {
    // Initial count: just moderator
    await expect(moderatorPage.locator('text=Participants (1)')).toBeVisible();

    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Count should update to 2
    await expect(moderatorPage.locator('text=Participants (2)')).toBeVisible();

    // Participant 2 joins
    await participant2Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant2Page.fill('[data-testid="name-input"]', 'Charlie');
    await participant2Page.click('[data-testid="join-session-btn"]');
    await participant2Page.waitForSelector('text=Charlie', { timeout: 5000 });

    // Count should update to 3
    await expect(moderatorPage.locator('text=Participants (3)')).toBeVisible();
  });

  test('should show visual distinction for moderators', async () => {
    // Moderator should have a moderator badge
    const aliceElement = moderatorPage.locator('[data-testid="participant-item-alice"]');
    await expect(aliceElement.locator('text=Moderator')).toBeVisible();

    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Bob should not have a moderator badge
    const bobElement = moderatorPage.locator('[data-testid="participant-item-bob"]');
    await expect(bobElement.locator('text=Moderator')).not.toBeVisible();
  });

  test('should show voting progress indicator', async () => {
    // Participant 1 joins
    await participant1Page.goto(`http://localhost:5173/session/${sessionId}`);
    await participant1Page.fill('[data-testid="name-input"]', 'Bob');
    await participant1Page.click('[data-testid="join-session-btn"]');
    await participant1Page.waitForSelector('text=Bob', { timeout: 5000 });

    // Initial state: 0 of 2 voted
    await expect(moderatorPage.locator('text=0 of 2 voted')).toBeVisible();

    // Bob votes
    await participant1Page.click('[data-testid="card-5"]');
    await moderatorPage.waitForTimeout(500);

    // Should show 1 of 2 voted
    await expect(moderatorPage.locator('text=1 of 2 voted')).toBeVisible();

    // Alice votes
    await moderatorPage.click('[data-testid="card-8"]');
    await moderatorPage.waitForTimeout(500);

    // Should show 2 of 2 voted (all voted)
    await expect(moderatorPage.locator('text=2 of 2 voted')).toBeVisible();
  });
});
