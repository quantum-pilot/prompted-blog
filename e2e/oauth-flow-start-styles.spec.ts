import { test, expect } from './fixtures/test-base';
import { waitForComponentReady } from './utils/helpers';

test.describe('OAuth Flow Start Styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForComponentReady(page, 'oauth-flow-start');
  });

  test('should have container with proper flex layout', async ({ page }) => {
    const container = page.locator('.oauth-buttons');
    await expect(container).toBeVisible();
    await expect(container).toHaveCSS('display', 'flex');
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 1025) {
      await expect(container).toHaveCSS('flex-direction', 'row');
      await expect(container).toHaveCSS('gap', '40px'); // 2.5rem
    } else if (viewportSize && viewportSize.width >= 769) {
      await expect(container).toHaveCSS('flex-direction', 'row');
      await expect(container).toHaveCSS('gap', '32px'); // 2rem
    } else {
      await expect(container).toHaveCSS('flex-direction', 'column');
      await expect(container).toHaveCSS('gap', '16px'); // 1rem
    }
  });

  test('should have distinct provider-specific styling', async ({ page }) => {
    const openaiButton = page.locator('[data-provider="openai"]');
    const claudeButton = page.locator('[data-provider="claude"]');
    const openaiBackground = await openaiButton.evaluate(el =>
      window.getComputedStyle(el).background
    );
    expect(openaiBackground).toContain('linear-gradient');

    const claudeBackground = await claudeButton.evaluate(el =>
      window.getComputedStyle(el).background
    );
    expect(claudeBackground).toContain('linear-gradient');
    expect(openaiBackground).not.toBe(claudeBackground);
  });

  test('should have proper button dimensions', async ({ page }) => {
    const openaiButton = page.locator('[data-provider="openai"]');
    const viewportSize = page.viewportSize();
    if (viewportSize && viewportSize.width >= 1025) {
      await expect(openaiButton).toHaveCSS('min-height', '52px');
    } else if (viewportSize && viewportSize.width >= 769) {
      await expect(openaiButton).toHaveCSS('min-height', '48px');
    } else {
      await expect(openaiButton).toHaveCSS('min-height', '44px');
    }
    const width = await openaiButton.evaluate(el =>
      window.getComputedStyle(el).width
    );
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const expectedWidth = viewportWidth * 0.25;
    const maxWidth = viewportSize && viewportSize.width >= 1025 ? 320 :
                     viewportSize && viewportSize.width >= 769 ? 280 :
                     viewportWidth * 0.25;

    const actualWidth = parseInt(width);
    expect(actualWidth).toBeLessThanOrEqual(maxWidth);
    expect(actualWidth).toBeGreaterThan(0);
  });

  test('should have accessible focus states', async ({ page }) => {
    const openaiButton = page.locator('[data-provider="openai"]');
    await openaiButton.focus();
    const outline = await openaiButton.evaluate(el =>
      window.getComputedStyle(el).outline
    );
    const boxShadow = await openaiButton.evaluate(el =>
      window.getComputedStyle(el).boxShadow
    );

    const hasFocusIndicator = outline !== 'none' || boxShadow !== 'none';
    expect(hasFocusIndicator).toBe(true);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);
    const container = page.locator('.oauth-buttons');
    const buttons = page.locator('.oauth-button');

    // But they may have max-width applied from parent container
    const buttonCount = await buttons.count();
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const width = await button.evaluate(el =>
        window.getComputedStyle(el).width
      );

      const actualWidth = parseInt(width);
      expect(actualWidth).toBeGreaterThan(80); // At least 80px wide
      expect(actualWidth).toBeLessThanOrEqual(375); // Not wider than viewport
    }
    await expect(container).toHaveCSS('flex-direction', 'column');
    await expect(container).toHaveCSS('gap', '16px');
  });
});
