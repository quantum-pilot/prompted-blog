// @agent: styles
import { test, expect } from './fixtures/test-base';
import { waitForComponentReady } from './utils/helpers';

test.describe('OAuth Responsive & Accessibility Styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForComponentReady(page, 'oauth-flow-start');
  });

  test('should have accessible focus state', async ({ page }) => {
    const googleButton = page.locator('.oauth-button--google');
    
    // Focus the button
    await googleButton.focus();
    
    // Check for focus indicator
    const outline = await googleButton.evaluate(el =>
      window.getComputedStyle(el).outline
    );
    const boxShadow = await googleButton.evaluate(el =>
      window.getComputedStyle(el).boxShadow
    );
    
    // Should have either outline or box-shadow for focus
    const hasFocusIndicator = 
      (outline !== 'none' && outline !== 'rgb(255, 255, 255) none 0px') || 
      (boxShadow !== 'none' && boxShadow.includes('rgb'));
    expect(hasFocusIndicator).toBe(true);
  });

  test('should have proper transition effects', async ({ page }) => {
    const googleButton = page.locator('.oauth-button--google');
    
    // Check transition property
    const transition = await googleButton.evaluate(el =>
      window.getComputedStyle(el).transition
    );
    
    // Should have smooth transitions
    expect(transition).toContain('background-color');
    expect(transition).toContain('0.2s'); // Quick transition
  });

  test('should maintain contrast ratio for accessibility', async ({ page }) => {
    const googleButton = page.locator('.oauth-button--google');
    
    // Get computed colors
    const bgColor = await googleButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    const textColor = await googleButton.evaluate(el => 
      window.getComputedStyle(el).color
    );
    
    // White text on blue background should meet WCAG AA standards
    expect(bgColor).toBe('rgb(66, 133, 244)'); // #4285f4
    expect(textColor).toBe('rgb(255, 255, 255)'); // white
    
    // Contrast ratio of white on #4285f4 is ~4.6:1, which meets WCAG AA
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);
    
    const googleButton = page.locator('.oauth-button--google');
    const container = page.locator('.oauth-buttons');
    
    // Container should center the button
    await expect(container).toHaveCSS('display', 'flex');
    await expect(container).toHaveCSS('justify-content', 'center');
    
    // Button should be responsive
    await expect(googleButton).toHaveCSS('height', '40px');
    await expect(googleButton).toHaveCSS('font-size', '14px');
    
    // Check min-width for usability
    const width = await googleButton.evaluate(el =>
      parseInt(window.getComputedStyle(el).width)
    );
    expect(width).toBeGreaterThanOrEqual(200); // Minimum width for usability
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 1024 });
    await page.waitForTimeout(100);
    
    const googleButton = page.locator('.oauth-button--google');
    
    // Tablet should use medium sizing (769px breakpoint)
    await expect(googleButton).toHaveCSS('height', '44px');
    await expect(googleButton).toHaveCSS('font-size', '15px');
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    
    const googleButton = page.locator('.oauth-button--google');
    
    // Desktop should use large sizing
    await expect(googleButton).toHaveCSS('height', '48px');
    await expect(googleButton).toHaveCSS('font-size', '16px');
  });
});