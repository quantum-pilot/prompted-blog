// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('username-modal status styles', () => {
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

  test('status indicator base styles', async ({ page }) => {
    const indicator = page.locator('.status-indicator').first();
    
    await expect(indicator).toHaveCSS('font-size', '14px');
    await expect(indicator).toHaveCSS('margin-top', '8px');
    await expect(indicator).toHaveCSS('min-height', '20px');
  });

  test('status checking state', async ({ page }) => {
    await page.evaluate(() => {
      const ind = document.querySelector('.status-indicator');
      ind?.classList.add('checking');
    });
    
    const statusChecking = page.locator('.status-indicator.checking').first();
    if (await statusChecking.count() > 0) {
      await expect(statusChecking).toHaveCSS('color', 'rgb(107, 114, 128)');
      
      const content = await statusChecking.evaluate(el => {
        const before = window.getComputedStyle(el, '::before');
        return before.content;
      });
      expect(content).toContain('Checking availability');
    }
  });

  test('status available state', async ({ page }) => {
    await page.evaluate(() => {
      const ind = document.querySelector('.status-indicator');
      ind?.classList.add('available');
    });
    
    const statusAvailable = page.locator('.status-indicator.available').first();
    if (await statusAvailable.count() > 0) {
      await expect(statusAvailable).toHaveCSS('color', 'rgb(34, 197, 94)');
      
      const content = await statusAvailable.evaluate(el => {
        const before = window.getComputedStyle(el, '::before');
        return before.content;
      });
      expect(content).toContain('Username available');
    }
  });

  test('status taken state', async ({ page }) => {
    await page.evaluate(() => {
      const ind = document.querySelector('.status-indicator');
      ind?.classList.add('taken');
    });
    
    const statusTaken = page.locator('.status-indicator.taken').first();
    if (await statusTaken.count() > 0) {
      await expect(statusTaken).toHaveCSS('color', 'rgb(239, 68, 68)');
      
      const content = await statusTaken.evaluate(el => {
        const before = window.getComputedStyle(el, '::before');
        return before.content;
      });
      expect(content).toContain('already taken');
    }
  });

  test('status error state', async ({ page }) => {
    await page.evaluate(() => {
      const ind = document.querySelector('.status-indicator');
      ind?.classList.add('error');
    });
    
    const statusError = page.locator('.status-indicator.error').first();
    if (await statusError.count() > 0) {
      await expect(statusError).toHaveCSS('color', 'rgb(239, 68, 68)');
      
      const content = await statusError.evaluate(el => {
        const before = window.getComputedStyle(el, '::before');
        return before.content;
      });
      expect(content).toContain('Error');
    }
  });
});