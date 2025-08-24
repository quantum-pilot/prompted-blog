import { hc } from 'hono/client';
import type { AppType } from '../../../workers/src/index';
import type { 
  OAuthAuthorizeResponse,
  OAuthAuthorizeRequest,
  SessionValidationSuccess,
  EnvironmentSchema 
} from '@app/shared';
import { 
  OAuthProvider,
  type OAuthConfig
} from '@app/shared';
import { createHonoClient } from './hono-client.js';

// OAuth error types
export enum OAuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  POPUP_BLOCKED = 'POPUP_BLOCKED',
  POPUP_CLOSED = 'POPUP_CLOSED',
  CSRF_ERROR = 'CSRF_ERROR',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * OAuth Error class
 */
export class OAuthError extends Error {
  constructor(
    public readonly type: OAuthErrorType,
    public readonly userMessage: string,
    public readonly technicalMessage: string,
    public readonly retryable: boolean,
    public readonly originalError?: Error
  ) {
    super(userMessage);
    this.name = 'OAuthError';
  }
}

/**
 * OAuth Client for handling authentication flows
 * Simplified to use direct redirect flow instead of popups
 */
export class OAuthClient {
  private config: OAuthConfig;
  private honoClient: ReturnType<typeof hc<AppType>>;

  constructor(config: Partial<OAuthConfig> = {}) {
    this.config = {
      workerUrl: config.workerUrl || window.location.origin,
      provider: config.provider || OAuthProvider.Google,
      clientId: config.clientId || '',
      redirectUri: config.redirectUri || `${window.location.origin}/oauth/callback`,
    };

    // Initialize Hono client
    this.honoClient = createHonoClient(this.config.workerUrl);
  }

  /**
   * Start OAuth flow with direct redirect
   */
  async startAuthFlow(): Promise<void> {
    try {
      // Generate PKCE parameters
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = await this.generateCodeChallenge(codeVerifier);
      const state = this.generateState();

      // Store PKCE parameters in sessionStorage for retrieval after redirect
      sessionStorage.setItem('oauth_code_verifier', codeVerifier);
      sessionStorage.setItem('oauth_state', state);

      // Request authorization URL from server
      const requestBody: OAuthAuthorizeRequest = {
        code_challenge: codeChallenge,
        state,
        provider: this.config.provider as "google" | "github",
      };

      const response = await this.honoClient.oauth.authorize.$get({
        query: requestBody,
      });

      if (!response.ok) {
        const errorType = response.status >= 500 ? OAuthErrorType.SERVER_ERROR : OAuthErrorType.AUTHORIZATION_FAILED;
        throw new OAuthError(
          errorType,
          'Failed to start authentication process. Please try again.',
          `Server returned status ${response.status}`,
          response.status >= 500
        );
      }

      let data: OAuthAuthorizeResponse;
      try {
        data = await response.json() as OAuthAuthorizeResponse;
      } catch (jsonError) {
        throw new OAuthError(
          OAuthErrorType.INVALID_RESPONSE,
          'Invalid response from server. Please try again.',
          'Failed to parse JSON response',
          false
        );
      }

      if (!data.success) {
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          'Failed to start authentication process. Please try again.',
          data.error || 'Unknown error',
          false
        );
      }

      // Redirect directly to OAuth provider
      window.location.href = (data as any).authorizationUrl || data.authUrl;
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      
      // Map specific error types
      const errorMessage = (error as Error).message?.toLowerCase() || '';
      let errorType = OAuthErrorType.UNKNOWN;
      
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        errorType = OAuthErrorType.NETWORK_ERROR;
      } else if (errorMessage.includes('json') || errorMessage.includes('parse')) {
        errorType = OAuthErrorType.INVALID_RESPONSE;
      }
      
      throw new OAuthError(
        errorType,
        'An unexpected error occurred. Please try again.',
        (error as Error).message,
        errorType === OAuthErrorType.NETWORK_ERROR,
        error as Error
      );
    }
  }

  /**
   * Validate session
   */
  async validateSession(): Promise<SessionValidationSuccess | null> {
    try {
      const response = await this.honoClient.oauth.session.$get();
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      // If the response has user data, it's a valid session
      // Wrap it in the expected format
      if (data && (data.userId || data.email)) {
        return {
          success: true,
          userId: data.userId,
          email: data.email,
          username: data.username,
          provider: data.provider,
          expiresAt: data.expiresAt
        } as SessionValidationSuccess;
      }
      
      // If it already has success field, return as is
      if (data && typeof data.success === 'boolean') {
        return data as SessionValidationSuccess;
      }
      
      return null;
    } catch (error) {
      console.error('Session validation failed:', error);
      return null;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await this.honoClient.oauth.logout.$post();
      
      // Clear any stored OAuth parameters
      sessionStorage.removeItem('oauth_code_verifier');
      sessionStorage.removeItem('oauth_state');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  /**
   * Generate code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Generate code challenge from verifier
   */
  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  /**
   * Generate random state
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  /**
   * Base64 URL encode
   */
  private base64UrlEncode(buffer: Uint8Array): string {
    return btoa(String.fromCharCode(...buffer))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}