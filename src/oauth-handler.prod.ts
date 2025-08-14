/**
 * Production OAuth handler - NO mock OAuth included
 */
import { 
  config, 
  handleOAuthCallback, 
  checkExistingSession, 
  startRealOAuthFlow 
} from './oauth-handler-base';

// OAuth integration handler - PRODUCTION VERSION
export function setupOAuthHandler(): void {
  document.addEventListener('oauth-start', async (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.provider === 'google') {
      // Always use real OAuth in production
      await startRealOAuthFlow();
    }
  });

  // Handle OAuth callback
  if (window.location.pathname === '/oauth/callback') {
    handleOAuthCallback();
  }

  // Check for existing session on load
  checkExistingSession();
}