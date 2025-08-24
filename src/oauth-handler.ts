/**
 * OAuth handler module - Production version
 * Handles OAuth flow via direct redirects
 * Integrates username setup flow after successful authentication
 */
import { OAuthClient } from "./api/oauth-client";
import { OAuthProvider, OAUTH_PROVIDERS } from "@app/shared";
import { checkAndShowUsernameSetup } from "./username-setup-handler";
import { authState } from "./auth-state";

// Create OAuth client instance
export const oauthClient = new OAuthClient({
  workerUrl: window.location.origin,
  clientId: OAUTH_PROVIDERS.google.clientId,
  redirectUri: `${window.location.origin}/oauth/callback`,
  provider: OAuthProvider.Google,
});

/**
 * Handle OAuth callback on page load
 */
async function handleOAuthCallback(): Promise<void> {
  try {
    // Get OAuth parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    if (error) {
      console.error('OAuth error:', error, urlParams.get('error_description'));
      // Clear URL parameters
      window.history.replaceState({}, document.title, "/");
      return;
    }

    if (!code || !state) {
      // Not an OAuth callback
      return;
    }

    // Get stored PKCE parameters
    const storedVerifier = sessionStorage.getItem('oauth_code_verifier');
    const storedState = sessionStorage.getItem('oauth_state');

    // Clear stored parameters
    sessionStorage.removeItem('oauth_code_verifier');
    sessionStorage.removeItem('oauth_state');

    // Validate state
    if (state !== storedState) {
      console.error('State mismatch - possible CSRF attack');
      window.history.replaceState({}, document.title, "/");
      return;
    }

    // Exchange code for tokens via direct form submission to server
    // This will set the cookie and redirect back
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/oauth/callback';
    
    const codeInput = document.createElement('input');
    codeInput.type = 'hidden';
    codeInput.name = 'code';
    codeInput.value = code;
    form.appendChild(codeInput);
    
    const stateInput = document.createElement('input');
    stateInput.type = 'hidden';
    stateInput.name = 'state';
    stateInput.value = state;
    form.appendChild(stateInput);
    
    const verifierInput = document.createElement('input');
    verifierInput.type = 'hidden';
    verifierInput.name = 'code_verifier';
    verifierInput.value = storedVerifier || '';
    form.appendChild(verifierInput);
    
    const providerInput = document.createElement('input');
    providerInput.type = 'hidden';
    providerInput.name = 'provider';
    providerInput.value = 'google';
    form.appendChild(providerInput);
    
    document.body.appendChild(form);
    form.submit();
  } catch (error) {
    console.error('OAuth callback error:', error);
    window.history.replaceState({}, document.title, "/");
  }
}

/**
 * Check for existing session on page load
 */
async function checkExistingSession(): Promise<void> {
  try {
    // Use centralized auth state check
    await authState.checkAuthStatus();
    const state = authState.getState();

    if (state.isAuthenticated && state.session) {
      // User is already authenticated
      const successEvent = new CustomEvent("oauth-restored", {
        detail: { user: state.session },
        bubbles: true,
      });
      document.dispatchEvent(successEvent);
      
      // Check and setup username if needed
      const userWithUsername = state.user || state.session;
      if (userWithUsername && !userWithUsername.username) {
        await checkAndShowUsernameSetup(userWithUsername);
      }
    }
  } catch (error) {
    console.error("Failed to check existing session:", error);
    // Silent failure - user is simply not logged in
  }
}

/**
 * Start OAuth flow via direct redirect
 */
async function startRealOAuthFlow(): Promise<void> {
  try {
    // Start OAuth flow with direct redirect
    await oauthClient.startAuthFlow();
    // Browser will redirect to OAuth provider
  } catch (error) {
    console.error("Failed to start OAuth flow:", error);
    const errorEvent = new CustomEvent("oauth-error", {
      detail: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      bubbles: true,
    });
    document.dispatchEvent(errorEvent);
  }
}

/**
 * Setup OAuth handler - registers event listeners
 */
export function setupOAuthHandler(): void {
  // Check if we're on the OAuth callback URL
  if (window.location.pathname === "/oauth/callback") {
    handleOAuthCallback();
    return; // Don't do anything else on callback page
  }

  // Listen for OAuth start events from UI components
  document.addEventListener("oauth-start", async (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.provider === "google") {
      await startRealOAuthFlow();
    }
  });

  // Check for existing session on load
  checkExistingSession();
}