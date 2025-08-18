/**
 * OAuth Client for frontend authentication
 * Handles OAuth flow with Google (and future providers) via Cloudflare Worker
 * Uses popup-only mode for security - no sessionStorage or redirect mode
 */

import * as oauth from "oauth4webapi";
import { 
  OAuthProvider, 
  OAuthSession, 
  OAuthCallbackResult, 
  OAuthConfig,
  OAUTH_PROVIDERS,
  getAuthorizationUrl
} from "@app/shared";
import {
  getSessionId,
  validateSessionWithWorker,
  clearOAuthData,
  storeSessionId,
} from "./oauth-session";
import { OAuthPopupHandler } from "./oauth-popup-handler";

export class OAuthClient {
  private readonly config: OAuthConfig;
  // Store PKCE parameters in memory for security
  private codeVerifier: string | null = null;
  private codeChallenge: string | null = null;
  private state: string | null = null;

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
    };
  }

  /**
   * Start OAuth authorization flow (popup mode only)
   */
  async startAuthFlow(): Promise<void> {
    // Generate PKCE parameters
    this.codeVerifier = oauth.generateRandomCodeVerifier();
    this.codeChallenge = await oauth.calculatePKCECodeChallenge(
      this.codeVerifier
    );

    // Generate secure random state for CSRF protection
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    this.state = btoa(String.fromCharCode(...randomBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Get provider configuration directly from shared constants
    const providerKey = this.config.provider.toLowerCase() as 'google' | 'github';
    const provider = OAUTH_PROVIDERS[providerKey];
    const scopes = provider.scopes;

    // Build authorization URL
    const authUrl = new URL(getAuthorizationUrl(providerKey));
    authUrl.searchParams.set("client_id", this.config.clientId);
    authUrl.searchParams.set("redirect_uri", this.config.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes.join(" "));
    authUrl.searchParams.set("state", this.state);
    authUrl.searchParams.set("code_challenge", this.codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    // Add provider-specific parameters
    if (provider.additionalParams) {
      Object.entries(provider.additionalParams).forEach(
        ([key, value]) => {
          authUrl.searchParams.set(key, value);
        }
      );
    }

    // Use popup mode only
    const popupHandler = new OAuthPopupHandler();
    try {
      popupHandler.openPopup(authUrl.toString());

      // Get the origin for message validation
      const callbackUrl = new URL(this.config.redirectUri);
      const allowedOrigin = callbackUrl.origin;

      // Wait for callback from popup
      const callbackData = await popupHandler.waitForCallback(allowedOrigin);

      // Validate state
      if (callbackData.state !== this.state) {
        throw new Error("State mismatch - possible CSRF attack");
      }

      // Exchange code for tokens
      if (callbackData.code) {
        await this.exchangeCodeForTokens(callbackData.code, this.state);
      }
    } catch (error) {
      // Handle popup-specific errors
      if (popupHandler.isPopupBlocked()) {
        throw new Error(
          "Popup was blocked. Please allow popups for authentication."
        );
      }
      throw error;
    } finally {
      // Always clean up
      popupHandler.cleanup();
      this.clearMemory();
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<void> {
    if (!this.codeVerifier) {
      throw new Error("Missing code verifier");
    }

    // Call worker to exchange code for tokens and create session
    const url = new URL("/oauth/callback", this.config.workerUrl);

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        state,
        code_verifier: this.codeVerifier,
        provider: this.config.provider!,
      }),
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = (await response.json()) as OAuthCallbackResult;

    // Store session ID if successful
    if (result.success && result.sessionId) {
      storeSessionId(result.sessionId);
    } else if (result.error) {
      throw new Error(`OAuth error: ${result.error}`);
    }
  }

  /**
   * Clear sensitive data from memory
   */
  private clearMemory(): void {
    this.codeVerifier = null;
    this.codeChallenge = null;
    this.state = null;
  }

  /**
   * Handle OAuth callback - for popup mode with in-memory PKCE params
   */
  async handleCallback(
    callbackUrl: URL,
    codeVerifier?: string,
    state?: string
  ): Promise<OAuthCallbackResult> {
    // This method is only for popup mode with provided PKCE params
    if (!codeVerifier || !state) {
      throw new Error(
        "Missing required PKCE parameters. Popup mode requires codeVerifier and state."
      );
    }

    const params = callbackUrl.searchParams;
    const code = params.get("code");
    const callbackState = params.get("state");

    // Verify state
    if (callbackState !== state) {
      throw new Error("State mismatch - possible CSRF attack");
    }

    if (!code) {
      throw new Error("Missing authorization code");
    }

    // Exchange code directly
    this.codeVerifier = codeVerifier;
    this.state = state;

    try {
      await this.exchangeCodeForTokens(code, state);
      return { success: true };
    } finally {
      this.clearMemory();
    }
  }

  /**
   * Validate current session with worker
   */
  async validateSession(): Promise<OAuthSession | null> {
    const sessionId = getSessionId();

    if (!sessionId) {
      return null;
    }

    return validateSessionWithWorker(this.config.workerUrl, sessionId);
  }

  logout(): void {
    clearOAuthData();
  }
}
