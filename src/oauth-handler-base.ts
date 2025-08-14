import { OAuthClient } from './api/oauth-client';
import { OAuthProvider } from './api/oauth-types';

// Configuration - in a real app, these would come from a config file or build process
const WORKER_URL = 'https://oauth.worker.dev';
const GOOGLE_CLIENT_ID = ''; // Set this for production

// Create OAuth client instance
export const oauthClient = new OAuthClient({
  workerUrl: WORKER_URL,
  clientId: GOOGLE_CLIENT_ID,
  redirectUri: `${window.location.origin}/oauth/callback`,
  provider: OAuthProvider.Google
});

// Export config for use in handlers
export const config = {
  WORKER_URL,
  GOOGLE_CLIENT_ID
};

// OAuth callback handler (shared between dev and prod)
export async function handleOAuthCallback(): Promise<void> {
  try {
    // Process the OAuth callback with worker
    const callbackUrl = new URL(window.location.href);
    const result = await oauthClient.handleCallback(callbackUrl);

    if (!result.success) {
      throw new Error(result.error || 'OAuth callback failed');
    }

    // Validate the session to get user info
    const session = await oauthClient.validateSession();

    if (session) {
      // Dispatch success event with user data
      const successEvent = new CustomEvent('oauth-success', {
        detail: { user: session },
        bubbles: true
      });
      document.dispatchEvent(successEvent);

      // Redirect to home page
      window.history.replaceState({}, document.title, '/');
    } else {
      throw new Error('Failed to validate session after OAuth callback');
    }
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorEvent = new CustomEvent('oauth-error', {
      detail: { error: error instanceof Error ? error.message : 'Unknown error' },
      bubbles: true
    });
    document.dispatchEvent(errorEvent);

    // Clear any invalid session data
    oauthClient.logout();

    // Redirect to home page on error
    setTimeout(() => {
      window.location.href = '/';
    }, 3000);
  }
}

/**
 * Check for existing session on page load
 */
export async function checkExistingSession(): Promise<void> {
  try {
    const session = await oauthClient.validateSession();

    if (session) {
      // User is already authenticated
      const successEvent = new CustomEvent('oauth-restored', {
        detail: { user: session },
        bubbles: true
      });
      document.dispatchEvent(successEvent);
    }
  } catch (error) {
    console.error('Failed to check existing session:', error);
    // Silent failure - user is simply not logged in
  }
}

/**
 * Start real OAuth flow
 */
export async function startRealOAuthFlow(): Promise<void> {
  try {
    await oauthClient.startAuthFlow();
  } catch (error) {
    console.error('Failed to start OAuth flow:', error);
    const errorEvent = new CustomEvent('oauth-error', {
      detail: { error: error instanceof Error ? error.message : 'Unknown error' },
      bubbles: true
    });
    document.dispatchEvent(errorEvent);
  }
}