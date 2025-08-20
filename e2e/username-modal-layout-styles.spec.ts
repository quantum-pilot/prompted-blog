// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('username-modal layout styles', () => {
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

  test('modal backdrop styles', async ({ page }) => {
    const backdrop = page.locator('.modal-backdrop').first();
    
    await expect(backdrop).toHaveCSS('position', 'fixed');
    await expect(backdrop).toHaveCSS('inset', '0px');
    
    const bgColor = await backdrop.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(bgColor).toMatch(/rgba?\(0,\s*0,\s*0,\s*0\.[3-7]\)/);
    
    const zIndex = await backdrop.evaluate(el => 
      window.getComputedStyle(el).zIndex
    );
    expect(parseInt(zIndex)).toBeGreaterThanOrEqual(999);
    
    await expect(backdrop).toHaveCSS('display', 'flex');
    await expect(backdrop).toHaveCSS('align-items', 'center');
    await expect(backdrop).toHaveCSS('justify-content', 'center');
  });

  test('modal card styles', async ({ page }) => {
    const modal = page.locator('.modal-card').first();
    
    await expect(modal).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(modal).toHaveCSS('border-radius', '8px');
    
    const padding = await modal.evaluate(el => 
      window.getComputedStyle(el).padding
    );
    expect(padding).toMatch(/24px|32px|1\.5rem|2rem/);
    
    const maxWidth = await modal.evaluate(el => 
      window.getComputedStyle(el).maxWidth
    );
    expect(parseInt(maxWidth)).toBeGreaterThanOrEqual(400);
    expect(parseInt(maxWidth)).toBeLessThanOrEqual(450);
    
    const boxShadow = await modal.evaluate(el => 
      window.getComputedStyle(el).boxShadow
    );
    expect(boxShadow).not.toBe('none');
    expect(boxShadow).toContain('rgba');
  });

  test('responsive breakpoints', async ({ page }) => {
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    const modalMobile = page.locator('.modal-card').first();
    const widthMobile = await modalMobile.evaluate(el => 
      window.getComputedStyle(el).width
    );
    expect(parseInt(widthMobile)).toBeLessThanOrEqual(375);
    
    // Tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    const modalTablet = page.locator('.modal-card').first();
    const widthTablet = await modalTablet.evaluate(el => 
      window.getComputedStyle(el).width
    );
    expect(parseInt(widthTablet)).toBeLessThanOrEqual(450);
    
    // Desktop view
    await page.setViewportSize({ width: 1440, height: 900 });
    const modalDesktop = page.locator('.modal-card').first();
    const widthDesktop = await modalDesktop.evaluate(el => 
      window.getComputedStyle(el).width
    );
    expect(parseInt(widthDesktop)).toBeLessThanOrEqual(450);
  });
});