/**
 * OAuth handler module - Production version
 * Always uses real OAuth flow without mock authentication
 */
import { OAuthClient } from "./api/oauth-client";
import { OAuthProvider } from "./api/oauth-types";
import { OAUTH_CLIENT_IDS } from "@app/shared";

// Create OAuth client instance
// Worker is on same origin, so we can use relative paths
export const oauthClient = new OAuthClient({
  workerUrl: window.location.origin,
  clientId: OAUTH_CLIENT_IDS.GOOGLE,
  redirectUri: `${window.location.origin}/oauth/callback`,
  provider: OAuthProvider.Google,
});

// OAuth callback handler
async function handleOAuthCallback(): Promise<void> {
  try {
    // Process the OAuth callback with worker
    const callbackUrl = new URL(window.location.href);
    const result = await oauthClient.handleCallback(callbackUrl);

    if (!result.success) {
      throw new Error(result.error || "OAuth callback failed");
    }

    // Validate the session to get user info
    const session = await oauthClient.validateSession();

    if (session) {
      // Dispatch success event with user data
      const successEvent = new CustomEvent("oauth-success", {
        detail: { user: session },
        bubbles: true,
      });
      document.dispatchEvent(successEvent);

      // Redirect to home page
      window.history.replaceState({}, document.title, "/");
    } else {
      throw new Error("Failed to validate session after OAuth callback");
    }
  } catch (error) {
    console.error("OAuth callback error:", error);
    const errorEvent = new CustomEvent("oauth-error", {
      detail: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      bubbles: true,
    });
    document.dispatchEvent(errorEvent);

    // Clear any invalid session data
    oauthClient.logout();

    // Redirect to home page on error
    setTimeout(() => {
      window.location.href = "/";
    }, 3000);
  }
}

async function checkExistingSession(): Promise<void> {
  try {
    const session = await oauthClient.validateSession();

    if (session) {
      // User is already authenticated
      const successEvent = new CustomEvent("oauth-restored", {
        detail: { user: session },
        bubbles: true,
      });
      document.dispatchEvent(successEvent);
    }
  } catch (error) {
    console.error("Failed to check existing session:", error);
    // Silent failure - user is simply not logged in
  }
}

async function startRealOAuthFlow(): Promise<void> {
  try {
    await oauthClient.startAuthFlow();
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

// OAuth integration handler - PRODUCTION VERSION
export function setupOAuthHandler(): void {
  document.addEventListener("oauth-start", async (event: Event) => {
    const customEvent = event as CustomEvent;
    if (customEvent.detail?.provider === "google") {
      // Always use real OAuth in production
      await startRealOAuthFlow();
    }
  });

  // Handle OAuth callback
  if (window.location.pathname === "/oauth/callback") {
    handleOAuthCallback();
  }

  // Check for existing session on load
  checkExistingSession();
}
