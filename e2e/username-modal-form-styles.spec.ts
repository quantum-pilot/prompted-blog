// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('username-modal form styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for page to load and main.js to register components
    await page.waitForLoadState('networkidle');
    // Create modal after components are registered
    await page.evaluate(() => {
      // Remove any existing modals first
      const existing = document.querySelector('username-setup-modal');
      if (existing) existing.remove();
      // Create new modal
      const modal = document.createElement('username-setup-modal');
      document.body.appendChild(modal);
    });
    await page.waitForSelector('.modal-backdrop', { timeout: 5000 });
  });

  test('typography styles', async ({ page }) => {
    const heading = page.locator('h2').first();
    const subtitle = page.locator('.subtitle').first();
    const preview = page.locator('.subdomain-preview').first();
    
    await expect(heading).toHaveCSS('font-size', '24px');
    await expect(heading).toHaveCSS('font-weight', '600');
    await expect(heading).toHaveCSS('margin-bottom', '8px');
    await expect(heading).toHaveCSS('color', 'rgb(17, 24, 39)');
    
    await expect(subtitle).toHaveCSS('font-size', '14px');
    await expect(subtitle).toHaveCSS('color', 'rgb(107, 114, 128)');
    await expect(subtitle).toHaveCSS('margin-bottom', '20px');
    
    await expect(preview).toHaveCSS('color', 'rgb(75, 85, 99)');
  });

  test('input field styles', async ({ page }) => {
    const input = page.locator('input[type="text"]').first();
    
    const inputWidth = await input.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return { boxSizing: computed.boxSizing };
    });
    expect(inputWidth.boxSizing).toBe('border-box');
    
    await expect(input).toHaveCSS('padding', '12px');
    await expect(input).toHaveCSS('font-size', '16px');
    await expect(input).toHaveCSS('border-radius', '4px');
    await expect(input).toHaveCSS('border-width', '1px');
    await expect(input).toHaveCSS('border-style', 'solid');
    await expect(input).toHaveCSS('border-color', 'rgb(209, 213, 219)');
    
    await input.focus();
    await expect(input).toHaveCSS('outline-width', '2px');
    await expect(input).toHaveCSS('outline-style', 'solid');
    await expect(input).toHaveCSS('outline-color', 'rgb(37, 99, 235)');
  });

  test('input validation states', async ({ page }) => {
    const input = page.locator('input[type="text"]').first();
    
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="text"]');
      inp?.classList.add('error');
    });
    
    const errorInput = page.locator('input.error').first();
    if (await errorInput.count() > 0) {
      await expect(errorInput).toHaveCSS('border-color', 'rgb(239, 68, 68)');
    }
    
    await page.evaluate(() => {
      const inp = document.querySelector('input[type="text"]');
      inp?.classList.remove('error');
      inp?.classList.add('success');
    });
    
    const successInput = page.locator('input.success').first();
    if (await successInput.count() > 0) {
      await expect(successInput).toHaveCSS('border-color', 'rgb(34, 197, 94)');
    }
  });

  test('button styles', async ({ page }) => {
    const button = page.locator('button[type="submit"]').first();
    
    await expect(button).toHaveCSS('font-size', '16px');
    await expect(button).toHaveCSS('font-weight', '500');
    await expect(button).toHaveCSS('padding', '12px 24px');
    await expect(button).toHaveCSS('border-radius', '4px');
    
    const border = await button.evaluate(el => window.getComputedStyle(el).border);
    expect(border).toMatch(/^0px/);
    
    // Disabled state (initial)
    await expect(button).toHaveCSS('background-color', 'rgb(229, 231, 235)');
    await expect(button).toHaveCSS('color', 'rgb(156, 163, 175)');
    await expect(button).toHaveCSS('cursor', 'not-allowed');
    
    // Enabled state
    await page.evaluate(() => {
      const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) btn.disabled = false;
    });
    
    await expect(button).toHaveCSS('background-color', 'rgb(66, 133, 244)');
    await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(button).toHaveCSS('cursor', 'pointer');
  });
});