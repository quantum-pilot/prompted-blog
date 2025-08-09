import { test, expect } from './fixtures/test-base';
import { waitForComponentReady } from './utils/helpers';

test.describe('OAuth Flow Start Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForComponentReady(page, 'oauth-flow-start');
  });

  test('should display both OAuth provider buttons', async ({ page }) => {
    const openaiButton = page.locator('[data-provider="openai"]');
    const claudeButton = page.locator('[data-provider="claude"]');

    await expect(openaiButton).toBeVisible();
    await expect(claudeButton).toBeVisible();

    await expect(openaiButton).toContainText('OpenAI');
    await expect(claudeButton).toContainText('Claude');
  });
  test('should emit oauth-start event on button click', async ({ page }) => {

    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('oauth-start', (e: any) => {
          resolve(e.detail);
        }, { once: true });
      });
    });

    // Click the OpenAI button
    await page.locator('[data-provider="openai"]').click();

    // Verify event was emitted with correct detail
    const eventDetail = await eventPromise;
    expect(eventDetail).toEqual({ provider: 'openai' });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    const openaiButton = page.locator('[data-provider="openai"]');
    const claudeButton = page.locator('[data-provider="claude"]');

    // Tab to first button
    await page.keyboard.press('Tab');
    await expect(openaiButton).toBeFocused();

    // Tab to second button
    await page.keyboard.press('Tab');
    await expect(claudeButton).toBeFocused();

    // Enter should trigger click
    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('oauth-start', (e: any) => {
          resolve(e.detail);
        }, { once: true });
      });
    });

    await page.keyboard.press('Enter');
    const eventDetail = await eventPromise;
    expect(eventDetail).toEqual({ provider: 'claude' });
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    const buttons = page.locator('.oauth-button');
    const buttonCount = await buttons.count();

    expect(buttonCount).toBe(2);

    // Check buttons are visible on mobile
    for (let i = 0; i < buttonCount; i++) {
      await expect(buttons.nth(i)).toBeVisible();
    }
  });
});
