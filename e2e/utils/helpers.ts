import { Page } from '@playwright/test';

export async function waitForComponentReady(page: Page, selector: string) {

  await page.waitForFunction(
    (sel) => {

      if (sel.includes('-')) {
        return customElements.get(sel) !== undefined;
      }

      return document.querySelector(sel) !== null;
    },
    selector,
    { timeout: 10000 }
  );

  await page.waitForSelector(selector, { state: 'attached', timeout: 10000 });

  await page.waitForTimeout(100);
}

export async function getComputedStyles(page: Page, selector: string) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;
    return window.getComputedStyle(element);
  }, selector);
}

export async function checkAccessibility(page: Page, selector?: string) {
  const target = selector ? await page.locator(selector) : page;


  const violations = await page.evaluate((sel) => {
    const issues = [];
    const element = sel ? document.querySelector(sel) : document.body;

    if (!element) return issues;

    const images = element.querySelectorAll('img');
    images.forEach((img) => {
      if (!img.alt && !img.getAttribute('aria-label')) {
        issues.push({ type: 'missing-alt', element: img.outerHTML });
      }
    });

    const buttons = element.querySelectorAll('button');
    buttons.forEach((btn) => {
      if (!btn.textContent?.trim() && !btn.getAttribute('aria-label')) {
        issues.push({ type: 'missing-button-text', element: btn.outerHTML });
      }
    });

    return issues;
  }, selector || null);

  return violations;
}
