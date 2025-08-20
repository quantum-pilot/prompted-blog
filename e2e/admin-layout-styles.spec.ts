// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('admin-layout styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForSelector('admin-layout');
  });

  test('desktop layout - sidebar fixed on left', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    
    const wrapper = page.locator('[data-layout-wrapper]');
    const sidebar = page.locator('[data-sidebar-wrapper]');
    const content = page.locator('[data-content-wrapper]');
    const toggleButton = page.locator('[data-menu-toggle]');
    
    // Check wrapper is flex container
    await expect(wrapper).toHaveCSS('display', 'flex');
    
    // Check sidebar is fixed width
    await expect(sidebar).toHaveCSS('width', '250px');
    await expect(sidebar).toHaveCSS('flex-shrink', '0');
    
    // Check content takes remaining space
    await expect(content).toHaveCSS('flex', '1 1 0%');
    
    // Toggle button hidden on desktop
    await expect(toggleButton).toHaveCSS('display', 'none');
  });

  test('mobile layout - sidebar hidden by default', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const sidebar = page.locator('[data-sidebar-wrapper]');
    const toggleButton = page.locator('[data-menu-toggle]');
    const adminLayout = page.locator('admin-layout');
    
    // Toggle button visible on mobile
    await expect(toggleButton).toHaveCSS('display', 'block');
    
    // Sidebar hidden by default
    await expect(sidebar).toHaveCSS('position', 'fixed');
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -250, 0)');
    
    // Check z-index for proper layering
    await expect(sidebar).toHaveCSS('z-index', '1000');
  });

  test('mobile menu toggle transitions', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const sidebar = page.locator('[data-sidebar-wrapper]');
    const toggleButton = page.locator('[data-menu-toggle]');
    
    // Check transition is set
    await expect(sidebar).toHaveCSS('transition-property', 'transform');
    await expect(sidebar).toHaveCSS('transition-duration', '0.3s');
    
    // Toggle menu open
    await toggleButton.click();
    await page.waitForSelector('admin-layout[data-menu-open="true"]');
    
    // Sidebar should slide in (transform: none becomes matrix identity)
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    
    // Toggle menu closed
    await toggleButton.click();
    await page.waitForSelector('admin-layout[data-menu-open="false"]');
    
    // Sidebar should slide out
    await expect(sidebar).toHaveCSS('transform', 'matrix(1, 0, 0, 1, -250, 0)');
  });

  test('responsive breakpoint at 768px', async ({ page }) => {
    // Just above breakpoint
    await page.setViewportSize({ width: 769, height: 600 });
    const toggleButton = page.locator('[data-menu-toggle]');
    await expect(toggleButton).toHaveCSS('display', 'none');
    
    // Just below breakpoint
    await page.setViewportSize({ width: 768, height: 600 });
    await expect(toggleButton).toHaveCSS('display', 'block');
  });
});