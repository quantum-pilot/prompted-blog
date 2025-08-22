// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('admin-profile styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/profile');
    await page.waitForSelector('admin-profile', { state: 'attached' });
  });

  test('form container styling and spacing', async ({ page }) => {
    // Check container styles
    const container = page.locator('[data-profile-container]');
    
    await expect(container).toHaveCSS('max-width', '600px');
    await expect(container).toHaveCSS('padding', '24px');
    await expect(container).toHaveCSS('margin', '0px auto');
  });

  test('form group spacing', async ({ page }) => {
    const formGroup = page.locator('.form-group').first();
    await expect(formGroup).toHaveCSS('margin-bottom', '20px');
  });

  test('label styling', async ({ page }) => {
    const label = page.locator('.form-group label').first();
    
    await expect(label).toHaveCSS('display', 'block');
    await expect(label).toHaveCSS('margin-bottom', '8px');
    await expect(label).toHaveCSS('font-weight', '500');
    await expect(label).toHaveCSS('font-size', '14px');
  });

  test('disabled input styling', async ({ page }) => {
    const input = page.locator('input[disabled]').first();
    
    await expect(input).toHaveCSS('width', '100%');
    await expect(input).toHaveCSS('padding', '10px 12px');
    await expect(input).toHaveCSS('background-color', 'rgb(243, 244, 246)');
    await expect(input).toHaveCSS('border-radius', '4px');
    await expect(input).toHaveCSS('opacity', '0.7');
    await expect(input).toHaveCSS('cursor', 'not-allowed');
  });

  test('responsive padding on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const container = page.locator('[data-profile-container]');
    await expect(container).toHaveCSS('padding', '16px');
  });
});