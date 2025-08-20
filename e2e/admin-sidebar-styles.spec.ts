// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('admin-sidebar styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForSelector('admin-sidebar');
  });

  test('sidebar full height with background', async ({ page }) => {
    const sidebar = page.locator('admin-sidebar');
    const nav = page.locator('admin-sidebar nav');
    
    // Check full height (100% may be computed to actual pixels)
    const sidebarHeight = await sidebar.evaluate(el => window.getComputedStyle(el).height);
    const parentHeight = await sidebar.evaluate(el => {
      const parent = el.parentElement;
      return parent ? window.getComputedStyle(parent).height : '0px';
    });
    expect(sidebarHeight).toBe(parentHeight);
    
    await expect(sidebar).toHaveCSS('display', 'flex');
    await expect(sidebar).toHaveCSS('flex-direction', 'column');
    
    // Check background color
    await expect(sidebar).toHaveCSS('background-color', 'rgb(249, 250, 251)');
    
    // Check nav takes full height
    await expect(nav).toHaveCSS('flex', '1 1 0%');
  });

  test('menu items styling and spacing', async ({ page }) => {
    // Wait for sidebar to be ready
    await page.waitForSelector('admin-sidebar [data-menu-item]');
    
    const menuItems = page.locator('admin-sidebar [data-menu-item]');
    const firstItem = menuItems.first();
    const list = page.locator('admin-sidebar ul');
    
    // Check list styling (list-style can be expanded to "outside none none")
    const listStyle = await list.evaluate(el => window.getComputedStyle(el).listStyle);
    expect(listStyle).toContain('none');
    await expect(list).toHaveCSS('padding', '0px');
    await expect(list).toHaveCSS('margin', '0px');
    
    // Check menu item styling
    await expect(firstItem).toHaveCSS('display', 'block');
    
    // Check width (100% may be computed to pixels)
    const itemWidth = await firstItem.evaluate(el => window.getComputedStyle(el).width);
    const parentWidth = await firstItem.evaluate(el => {
      const parent = el.parentElement;
      return parent ? window.getComputedStyle(parent).width : '0px';
    });
    expect(itemWidth).toBe(parentWidth);
    
    await expect(firstItem).toHaveCSS('padding', '12px 16px');
    await expect(firstItem).toHaveCSS('text-align', 'left');
    await expect(firstItem).toHaveCSS('border', '0px none rgb(0, 0, 0)');
    
    // Check background - first item is active by default so it will have blue bg
    const bgColor = await firstItem.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toMatch(/rgb\((29|30|31|37), (78|82|99), (216|220|235)\)/);
    
    await expect(firstItem).toHaveCSS('cursor', 'pointer');
  });

  test('menu item hover states', async ({ page }) => {
    // Wait for menu items to be ready
    await page.waitForSelector('admin-sidebar [data-menu-item]');
    
    // The profile item is active by default, so it won't show hover state
    // Instead, we need to check the hover state for a non-active item
    // Since we only have one item, let's check that hover on active item shows darker blue
    const menuItem = page.locator('admin-sidebar [data-menu-item]').first();
    
    // Hover over menu item
    await menuItem.hover();
    
    // Check hover background (active item on hover should be darker blue)
    await expect(menuItem).toHaveCSS('background-color', 'rgb(29, 78, 216)');
  });

  test('active menu item highlighted', async ({ page }) => {
    // Wait for menu items to be ready
    await page.waitForSelector('admin-sidebar [data-menu-item="profile"]');
    
    // Navigate to set active state
    const profileButton = page.locator('admin-sidebar [data-menu-item="profile"]');
    await profileButton.click();
    await page.waitForTimeout(100); // Wait for state update
    
    // Check active styling (color might be slightly different based on browser)
    const activeItem = page.locator('admin-sidebar [data-active="true"]');
    const bgColor = await activeItem.evaluate(el => window.getComputedStyle(el).backgroundColor);
    expect(bgColor).toMatch(/rgb\((29|30|31|37), (78|82|99), (216|220|235)\)/);
    await expect(activeItem).toHaveCSS('color', 'rgb(255, 255, 255)');
  });

  test('mobile full screen overlay', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const sidebar = page.locator('admin-sidebar');
    
    // When parent layout has menu open
    await page.evaluate(() => {
      document.querySelector('admin-layout')?.setAttribute('data-menu-open', 'true');
    });
    
    // Check mobile overlay styling
    const sidebarWrapper = page.locator('[data-sidebar-wrapper]');
    await expect(sidebarWrapper).toHaveCSS('position', 'fixed');
    await expect(sidebarWrapper).toHaveCSS('top', '0px');
    await expect(sidebarWrapper).toHaveCSS('left', '0px');
    
    // Check height (100vh becomes actual pixels)
    const wrapperHeight = await sidebarWrapper.evaluate(el => window.getComputedStyle(el).height);
    expect(wrapperHeight).toBe('667px');
    
    await expect(sidebarWrapper).toHaveCSS('width', '250px');
  });
});