// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('auth-handler styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should have correct base styles', async ({ page }) => {
    const authHandler = page.locator('auth-handler');
    await expect(authHandler).toHaveCount(1);
    
    const styles = await authHandler.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { display: s.display, padding: s.padding, margin: s.margin, border: s.border };
    });
    
    expect(['inline', 'contents', 'none'].includes(styles.display)).toBeTruthy();
    expect(styles.padding).toBe('0px');
    expect(styles.margin).toBe('0px');
    expect(styles.border).toMatch(/^(0px|none)/);
  });

  test('should support loading state class', async ({ page }) => {
    const authHandler = page.locator('auth-handler');
    await authHandler.evaluate(el => el.classList.add('loading'));
    
    const styles = await authHandler.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { opacity: s.opacity, pointerEvents: s.pointerEvents };
    });
    
    expect(styles.opacity).toBe('0.6');
    expect(styles.pointerEvents).toBe('none');
  });

  test('should support transitioning class', async ({ page }) => {
    const authHandler = page.locator('auth-handler');
    await authHandler.evaluate(el => el.classList.add('transitioning'));
    
    const transition = await authHandler.evaluate(el => 
      window.getComputedStyle(el).transition
    );
    expect(transition).toContain('opacity');
    expect(transition).toContain('0.3s');
  });

  test('should maintain non-visual presence', async ({ page }) => {
    const authHandler = page.locator('auth-handler');
    
    const styles = await authHandler.evaluate(el => {
      const s = window.getComputedStyle(el);
      return { position: s.position, background: s.background, boxShadow: s.boxShadow };
    });
    
    expect(styles.position).toBe('static');
    expect(styles.background).toMatch(/^(none|rgba\(0, 0, 0, 0\))/);
    expect(styles.boxShadow).toBe('none');
  });

  test('should handle hidden state', async ({ page }) => {
    const authHandler = page.locator('auth-handler');
    await authHandler.evaluate(el => el.setAttribute('hidden', ''));
    
    const display = await authHandler.evaluate(el => 
      window.getComputedStyle(el).display
    );
    expect(display).toBe('none');
  });
});