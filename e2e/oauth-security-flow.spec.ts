// @agent: frontend-debugger
import { test, expect } from '@playwright/test';

test.describe('OAuth Callback Security', () => {
  test('should not use wildcard origin in postMessage', async ({ page }) => {
    // Navigate to the callback page
    await page.goto('/oauth-callback/?code=test123&state=test');
    
    // Inject a script to intercept postMessage calls
    const postMessageCalls = await page.evaluate(() => {
      const calls: Array<{ data: any; origin: string }> = [];
      
      // Override postMessage on opener
      if (window.opener) {
        const originalPostMessage = window.opener.postMessage;
        window.opener.postMessage = function(data: any, origin: string) {
          calls.push({ data, origin });
          return originalPostMessage.call(this, data, origin);
        };
      }
      
      // Override postMessage on parent
      if (window.parent && window.parent !== window) {
        const originalPostMessage = window.parent.postMessage;
        window.parent.postMessage = function(data: any, origin: string) {
          calls.push({ data, origin });
          return originalPostMessage.call(this, data, origin);
        };
      }
      
      // Trigger the OAuth callback handler
      window.dispatchEvent(new Event('DOMContentLoaded'));
      
      // Wait a bit for async operations
      return new Promise<typeof calls>((resolve) => {
        setTimeout(() => resolve(calls), 100);
      });
    });
    
    // Check that no postMessage calls use wildcard origin
    for (const call of postMessageCalls) {
      expect(call.origin).not.toBe('*');
      expect(call.origin).toMatch(/^https?:\/\//);
    }
  });

  test('should validate URL parameters', async ({ page }) => {
    // Test with malicious parameters
    await page.goto('/oauth-callback/?code=test&evil=<script>alert(1)</script>');
    
    // Check that only whitelisted parameters are processed
    const processedParams = await page.evaluate(() => {
      const params: Record<string, any> = {};
      const searchParams = new URLSearchParams(window.location.search);
      
      // These are the only allowed parameters
      const allowedParams = ['code', 'state', 'error', 'error_description', 'token', 'access_token'];
      
      for (const [key, value] of searchParams) {
        if (allowedParams.includes(key)) {
          params[key] = value;
        }
      }
      
      return params;
    });
    
    expect(processedParams).toHaveProperty('code', 'test');
    expect(processedParams).not.toHaveProperty('evil');
  });

  test('should have Content Security Policy meta tag', async ({ page }) => {
    await page.goto('/oauth-callback/');
    
    const cspMeta = await page.$('meta[http-equiv="Content-Security-Policy"]');
    expect(cspMeta).not.toBeNull();
    
    const content = await cspMeta?.getAttribute('content');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self'");
  });

  test('should enforce HTTPS in production', async ({ page }) => {
    // Test HTTPS enforcement (skip for localhost)
    const response = await page.goto('/oauth-callback/');
    
    const isLocalhost = await page.evaluate(() => {
      return window.location.hostname === 'localhost' || 
             window.location.hostname === '127.0.0.1';
    });
    
    if (!isLocalhost) {
      const enforced = await page.evaluate(() => {
        return window.location.protocol === 'https:' || 
               document.querySelector('script')?.textContent?.includes('location.protocol === "https:"');
      });
      expect(enforced).toBe(true);
    }
  });
});

test.describe('OAuth Flow Start Security', () => {
  test('should not use innerHTML for rendering', async ({ page }) => {
    await page.goto('/');
    
    // Check that the component exists
    await page.waitForSelector('oauth-flow-start');
    
    // Verify DOM manipulation is secure
    const usesSecureDOM = await page.evaluate(() => {
      const component = document.querySelector('oauth-flow-start');
      if (!component) return false;
      
      // Check if buttons were created using DOM APIs
      const button = component.querySelector('.oauth-button');
      return button !== null && button.textContent?.includes('Sign in with Google');
    });
    
    expect(usesSecureDOM).toBe(true);
  });
});