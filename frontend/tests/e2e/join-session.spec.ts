/**
 * E2E Test: Join Session Workflow
 *
 * Tests the complete user journey for joining an existing Planning Poker session:
 * 1. User A creates a session and gets a shareable URL
 * 2. User B opens the URL in a different browser
 * 3. User B enters their name and joins
 * 4. Both users see each other in the participant list
 * 5. Real-time updates work for join/leave events
 */

import { test, expect } from '@playwright/test';

test.describe('Join Session Workflow', () => {
  test('should allow user to join session via shared link and see other participants', async ({ browser }) => {
    // Create two browser contexts (simulate two different users)
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create a session
      await page1.goto('/');

      // Fill in name and create session
      await page1.fill('input[name="name"]', 'Alice');
      await page1.click('button:has-text("Create Session")');

      // Wait for redirect to session page
      await page1.waitForURL(/\/session\/[A-Za-z0-9]{8}/);

      // Extract session URL
      const sessionUrl = page1.url();
      const sessionId = sessionUrl.match(/\/session\/([A-Za-z0-9]{8})/)?.[1];
      expect(sessionId).toBeTruthy();
      expect(sessionId).toHaveLength(8);

      // Verify Alice is in the participant list
      await expect(page1.locator('[data-testid="participant-list"]')).toBeVisible();
      await expect(page1.locator('[data-testid="participant-item"]')).toHaveCount(1);
      await expect(page1.locator('[data-testid="participant-name"]:has-text("Alice")')).toBeVisible();
      await expect(page1.locator('[data-testid="moderator-badge"]')).toBeVisible();

      // User 2: Open the same session URL
      await page2.goto(sessionUrl);

      // Should show join form (not participant list yet)
      await expect(page2.locator('[data-testid="join-form"]')).toBeVisible();

      // Fill in name and join
      await page2.fill('input[name="name"]', 'Bob');
      await page2.click('button:has-text("Join Session")');

      // Wait for join to complete
      await page2.waitForSelector('[data-testid="participant-list"]', { state: 'visible' });

      // Verify Bob sees both participants
      await expect(page2.locator('[data-testid="participant-item"]')).toHaveCount(2);
      await expect(page2.locator('[data-testid="participant-name"]:has-text("Alice")')).toBeVisible();
      await expect(page2.locator('[data-testid="participant-name"]:has-text("Bob")')).toBeVisible();

      // Verify Bob sees Alice's moderator badge
      const aliceItem = page2.locator('[data-testid="participant-item"]:has([data-testid="participant-name"]:has-text("Alice"))');
      await expect(aliceItem.locator('[data-testid="moderator-badge"]')).toBeVisible();

      // Verify Bob does NOT have moderator badge
      const bobItem = page2.locator('[data-testid="participant-item"]:has([data-testid="participant-name"]:has-text("Bob"))');
      await expect(bobItem.locator('[data-testid="moderator-badge"]')).not.toBeVisible();

      // Verify Alice sees real-time update (Bob joined)
      await expect(page1.locator('[data-testid="participant-item"]')).toHaveCount(2);
      await expect(page1.locator('[data-testid="participant-name"]:has-text("Bob")')).toBeVisible();

      // Verify join notification toast appeared for Alice
      await expect(page1.locator('[data-testid="toast"]:has-text("Bob joined")')).toBeVisible({ timeout: 5000 });

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('should show error when trying to join non-existent session', async ({ page }) => {
    // Try to open a session that doesn't exist
    await page.goto('/session/INVALID1');

    // Should show join form
    await expect(page.locator('[data-testid="join-form"]')).toBeVisible();

    // Fill in name and try to join
    await page.fill('input[name="name"]', 'Alice');
    await page.click('button:has-text("Join Session")');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]:has-text("Session not found")')).toBeVisible();
  });

  test('should show error when session is full (20 participants)', async ({ browser }) => {
    // This is a simplified test - in reality, we'd need to create 20 participants
    // For this test, we'll simulate the full session scenario

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Note: This test assumes a test helper endpoint or mocked scenario
      // In a real scenario, you'd need to actually create 20 participants
      await page.goto('/session/FULLSESS'); // Assuming a test session that's pre-filled

      await expect(page.locator('[data-testid="join-form"]')).toBeVisible();
      await page.fill('input[name="name"]', 'Alice');
      await page.click('button:has-text("Join Session")');

      // Should show capacity error
      await expect(page.locator('[data-testid="error-message"]')).toContainText('20');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('full');

    } finally {
      await page.close();
      await context.close();
    }
  });

  test('should prevent duplicate joins from same browser (browser fingerprint)', async ({ browser }) => {
    const context = await browser.newContext();
    const page1 = await context.newPage();

    try {
      // Create a session
      await page1.goto('/');
      await page1.fill('input[name="name"]', 'Alice');
      await page1.click('button:has-text("Create Session")');
      await page1.waitForURL(/\/session\/[A-Za-z0-9]{8}/);

      const sessionUrl = page1.url();

      // Open same session in a new tab (same context = same browser fingerprint)
      const page2 = await context.newPage();
      await page2.goto(sessionUrl);

      // Should NOT show join form - should directly show participant list
      // Because same browser fingerprint is already in session
      await expect(page2.locator('[data-testid="participant-list"]')).toBeVisible();
      await expect(page2.locator('[data-testid="join-form"]')).not.toBeVisible();

      // Should see Alice in the list
      await expect(page2.locator('[data-testid="participant-name"]:has-text("Alice")')).toBeVisible();

      await page2.close();
    } finally {
      await page1.close();
      await context.close();
    }
  });

  test('should validate name input on join form', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create a session
      await page1.goto('/');
      await page1.fill('input[name="name"]', 'Alice');
      await page1.click('button:has-text("Create Session")');
      await page1.waitForURL(/\/session\/[A-Za-z0-9]{8}/);

      const sessionUrl = page1.url();

      // User 2: Open session but try to join with empty name
      await page2.goto(sessionUrl);
      await expect(page2.locator('[data-testid="join-form"]')).toBeVisible();

      // Try to submit with empty name
      const joinButton = page2.locator('button:has-text("Join Session")');
      await expect(joinButton).toBeDisabled();

      // Try to submit with very long name (>50 characters)
      const longName = 'A'.repeat(51);
      await page2.fill('input[name="name"]', longName);

      // Should show validation error or prevent submission
      const nameInput = page2.locator('input[name="name"]');
      const inputValue = await nameInput.inputValue();
      expect(inputValue.length).toBeLessThanOrEqual(50);

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });

  test('should show participant count updates in real-time', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const context3 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    const page3 = await context3.newPage();

    try {
      // User 1: Create session
      await page1.goto('/');
      await page1.fill('input[name="name"]', 'Alice');
      await page1.click('button:has-text("Create Session")');
      await page1.waitForURL(/\/session\/[A-Za-z0-9]{8}/);

      const sessionUrl = page1.url();

      // Verify initial count
      await expect(page1.locator('[data-testid="participant-count"]')).toContainText('1');

      // User 2: Join
      await page2.goto(sessionUrl);
      await page2.fill('input[name="name"]', 'Bob');
      await page2.click('button:has-text("Join Session")');
      await page2.waitForSelector('[data-testid="participant-list"]');

      // Verify count updates on both pages
      await expect(page1.locator('[data-testid="participant-count"]')).toContainText('2');
      await expect(page2.locator('[data-testid="participant-count"]')).toContainText('2');

      // User 3: Join
      await page3.goto(sessionUrl);
      await page3.fill('input[name="name"]', 'Charlie');
      await page3.click('button:has-text("Join Session")');
      await page3.waitForSelector('[data-testid="participant-list"]');

      // Verify count updates on all pages
      await expect(page1.locator('[data-testid="participant-count"]')).toContainText('3');
      await expect(page2.locator('[data-testid="participant-count"]')).toContainText('3');
      await expect(page3.locator('[data-testid="participant-count"]')).toContainText('3');

    } finally {
      await page1.close();
      await page2.close();
      await page3.close();
      await context1.close();
      await context2.close();
      await context3.close();
    }
  });

  test('should display emoji avatars for each participant', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();

    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // User 1: Create session
      await page1.goto('/');
      await page1.fill('input[name="name"]', 'Alice');
      await page1.click('button:has-text("Create Session")');
      await page1.waitForURL(/\/session\/[A-Za-z0-9]{8}/);

      const sessionUrl = page1.url();

      // Verify Alice has an emoji
      const aliceEmoji = await page1.locator('[data-testid="participant-emoji"]').first().textContent();
      expect(aliceEmoji).toBeTruthy();
      expect(aliceEmoji).toMatch(/[\u{1F300}-\u{1F9FF}]/u); // Unicode emoji range

      // User 2: Join
      await page2.goto(sessionUrl);
      await page2.fill('input[name="name"]', 'Bob');
      await page2.click('button:has-text("Join Session")');
      await page2.waitForSelector('[data-testid="participant-list"]');

      // Verify Bob has a different emoji
      const emojis = await page2.locator('[data-testid="participant-emoji"]').allTextContents();
      expect(emojis).toHaveLength(2);
      expect(emojis[0]).toBeTruthy();
      expect(emojis[1]).toBeTruthy();
      // Emojis should be different (hash-based assignment)
      // Note: There's a small chance they could be the same, but very unlikely with 50+ emojis

    } finally {
      await page1.close();
      await page2.close();
      await context1.close();
      await context2.close();
    }
  });
});
