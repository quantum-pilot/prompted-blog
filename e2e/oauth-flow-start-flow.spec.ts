import { test, expect } from './fixtures/test-base';
import { waitForComponentReady } from './utils/helpers';

test.describe('OAuth Flow Start Component', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForComponentReady(page, 'oauth-flow-start');
  });

  test('should display Google OAuth button', async ({ page }) => {
    const googleButton = page.locator('[data-provider="google"]');

    await expect(googleButton).toBeVisible();
    await expect(googleButton).toContainText('Sign in with Google');
  });
  test('should emit oauth-start event on button click', async ({ page }) => {

    const eventPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('oauth-start', (e: any) => {
          resolve(e.detail);
        }, { once: true });
      });
    });

    // Click the Google button
    await page.locator('[data-provider="google"]').click();

    // Verify event was emitted with correct detail
    const eventDetail = await eventPromise;
    expect(eventDetail).toEqual({ provider: 'google' });
  });

  test('should handle keyboard navigation', async ({ page }) => {
    const googleButton = page.locator('[data-provider="google"]');

    // Tab to Google button
    await page.keyboard.press('Tab');
    await expect(googleButton).toBeFocused();

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
    expect(eventDetail).toEqual({ provider: 'google' });
  });

  test('should be responsive on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
    }

    const buttons = page.locator('.oauth-button');
    const buttonCount = await buttons.count();

    expect(buttonCount).toBe(1);

    // Check button is visible on mobile
    await expect(buttons.first()).toBeVisible();
    await expect(buttons.first()).toContainText('Sign in with Google');
  });
});
