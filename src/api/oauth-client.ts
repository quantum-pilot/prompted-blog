/**
 * OAuth Client for frontend authentication
 * Handles OAuth flow with Google (and future providers) via Cloudflare Worker
 * Uses popup-only mode for security - no sessionStorage or redirect mode
 * Sessions are managed via HttpOnly cookies set by the backend
 */

import * as oauth from "oauth4webapi";
import { 
  OAuthProvider, 
  OAuthSession, 
  OAuthCallbackResult, 
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  OAuthConfig,
  OAUTH_PROVIDERS,
  getAuthorizationUrl
} from "@app/shared";
import { createHonoClient } from "./hono-client";
import { validateSessionWithWorker } from "./oauth-session";
import { OAuthPopupHandler } from "./oauth-popup-handler";

export class OAuthClient {
  private readonly config: OAuthConfig;
  private readonly honoClient: ReturnType<typeof createHonoClient>;
  // Store PKCE parameters in memory for security
  private codeVerifier: string | null = null;
  private codeChallenge: string | null = null;
  private state: string | null = null;

  constructor(config: OAuthConfig) {
    this.config = {
      ...config,
    };
    // Create Hono client with the configured worker URL
    this.honoClient = createHonoClient(config.workerUrl);
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

    // Create typed request body
    const requestBody: OAuthCallbackRequest = {
      code,
      state,
      code_verifier: this.codeVerifier,
      provider: this.config.provider as "google" | "github",
    };

    // Use Hono client for type-safe API call
    const response = await this.honoClient.oauth.callback.$post({
      json: requestBody,
    });

    if (!response.ok) {
      throw new Error(`Worker error: ${response.status}`);
    }

    const result = (await response.json()) as OAuthCallbackResponse;

    // Use discriminated union to handle response
    if (!result.success) {
      // TypeScript knows this is OAuthCallbackError
      throw new Error(`OAuth error: ${result.error}: ${result.error_description}`);
    }
    // Success - cookies are set by the backend automatically
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
   * Uses cookies for authentication (no sessionId needed)
   */
  async validateSession(): Promise<OAuthSession | null> {
    return validateSessionWithWorker(this.config.workerUrl);
  }

  /**
   * Logout - calls backend to clear session and redirects to home
   * Always succeeds from user perspective (errors are logged but not thrown)
   */
  async logout(): Promise<void> {
    try {
      // Call the logout endpoint to clear server-side session
      // The backend will clear the HttpOnly cookie
      const response = await this.honoClient.oauth.logout.$post({});
      
      // Log non-ok responses for debugging
      if (!response.ok) {
        console.error('Logout API returned non-ok status:', response.status);
      }
    } catch (error) {
      // Log error for debugging but don't throw
      // User wants to logout regardless of server errors
      console.error('Logout error:', error);
    }
    
    // Clear any remaining in-memory OAuth state
    this.clearMemory();
    
    // Dispatch a custom event for other components to react to logout
    window.dispatchEvent(new CustomEvent('oauth:logout'));
    
    // Always redirect to home page after logout
    window.location.href = '/';
  }
}
