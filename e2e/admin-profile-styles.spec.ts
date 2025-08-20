// @agent: styles
import { test, expect } from '@playwright/test';

test.describe('admin-profile styles', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/profile');
    await page.waitForSelector('admin-profile');
  });

  test('form container styling and spacing', async ({ page }) => {
    const profileComponent = page.locator('admin-profile');
    const shadowHost = await profileComponent.evaluateHandle(el => el.shadowRoot);
    
    // Check container styles
    const container = await shadowHost.$('[data-profile-container]');
    const containerStyles = await container?.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        maxWidth: styles.maxWidth,
        padding: styles.padding,
        margin: styles.margin
      };
    });
    
    expect(containerStyles?.maxWidth).toBe('600px');
    expect(containerStyles?.padding).toBe('24px');
    expect(containerStyles?.margin).toBe('0px auto');
  });

  test('form group spacing', async ({ page }) => {
    const profileComponent = page.locator('admin-profile');
    const shadowHost = await profileComponent.evaluateHandle(el => el.shadowRoot);
    
    const formGroup = await shadowHost.$('.form-group');
    const formGroupStyles = await formGroup?.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        marginBottom: styles.marginBottom
      };
    });
    
    expect(formGroupStyles?.marginBottom).toBe('20px');
  });

  test('label styling', async ({ page }) => {
    const profileComponent = page.locator('admin-profile');
    const shadowHost = await profileComponent.evaluateHandle(el => el.shadowRoot);
    
    const label = await shadowHost.$('label');
    const labelStyles = await label?.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        display: styles.display,
        marginBottom: styles.marginBottom,
        fontWeight: styles.fontWeight,
        fontSize: styles.fontSize
      };
    });
    
    expect(labelStyles?.display).toBe('block');
    expect(labelStyles?.marginBottom).toBe('8px');
    expect(labelStyles?.fontWeight).toBe('500');
    expect(labelStyles?.fontSize).toBe('14px');
  });

  test('disabled input styling', async ({ page }) => {
    const profileComponent = page.locator('admin-profile');
    const shadowHost = await profileComponent.evaluateHandle(el => el.shadowRoot);
    
    const input = await shadowHost.$('input[disabled]');
    const inputStyles = await input?.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        width: styles.width,
        padding: styles.padding,
        backgroundColor: styles.backgroundColor,
        border: styles.border,
        borderRadius: styles.borderRadius,
        opacity: styles.opacity,
        cursor: styles.cursor
      };
    });
    
    expect(inputStyles?.width).toBe('100%');
    expect(inputStyles?.padding).toBe('10px 12px');
    expect(inputStyles?.backgroundColor).toBe('rgb(243, 244, 246)');
    expect(inputStyles?.border).toMatch(/1px solid/);
    expect(inputStyles?.borderRadius).toBe('4px');
    expect(inputStyles?.opacity).toBe('0.7');
    expect(inputStyles?.cursor).toBe('not-allowed');
  });

  test('responsive padding on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const profileComponent = page.locator('admin-profile');
    const shadowHost = await profileComponent.evaluateHandle(el => el.shadowRoot);
    
    const container = await shadowHost.$('[data-profile-container]');
    const containerStyles = await container?.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        padding: styles.padding
      };
    });
    
    expect(containerStyles?.padding).toBe('16px');
  });
});