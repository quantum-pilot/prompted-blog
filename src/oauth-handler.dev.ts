/**
 * Development OAuth handler - includes mock OAuth for local testing
 */
import { 
  config, 
  handleOAuthCallback, 
  checkExistingSession, 
  startRealOAuthFlow 
} from './oauth-handler-base';
import { mockOAuthFlow } from './mock-oauth';

// OAuth integration handler - DEVELOPMENT VERSION
export function setupOAuthHandler(): void {
  document.addEventListener('oauth-start', async (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.provider === 'google') {
      
      // In development, use mock OAuth on localhost without client ID
      if (window.location.hostname === 'localhost' && !config.GOOGLE_CLIENT_ID) {
        mockOAuthFlow();
        return;
      }
      
      // Otherwise use real OAuth
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