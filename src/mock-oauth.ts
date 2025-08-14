/**
 * Mock OAuth implementation for development only
 * This entire module should be tree-shaken in production builds
 */

import { storeSessionId } from './api/oauth-session.js';

export function mockOAuthFlow(): void {
  console.log('Development mode: Mocking OAuth flow');

  // Mock successful authentication
  const mockUser = {
    userId: 'dev-user-123',
    email: 'developer@example.com',
    name: 'Dev User',
    picture: 'https://via.placeholder.com/100'
  };

  // Store mock session in memory only
  storeSessionId('mock-session-123');

  // Dispatch success event
  const successEvent = new CustomEvent('oauth-success', {
    detail: { user: mockUser },
    bubbles: true
  });
  document.dispatchEvent(successEvent);

  console.log('Mock OAuth completed:', mockUser);
}

export function shouldUseMockAuth(): boolean {
  // Only use mock auth if:
  // 1. We're on localhost
  // 2. No Google Client ID is configured
  // Note: This function is kept for backwards compatibility but
  // the check is now done directly in oauth-handler.ts
  return window.location.hostname === 'localhost';
}