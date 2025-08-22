/**
 * OAuth Client for frontend authentication
 * Handles OAuth flow with Google (and future providers) via Cloudflare Worker
 * Uses popup-only mode for security - no sessionStorage or redirect mode
 * Sessions are managed via HttpOnly cookies set by the backend
 */

import { 
  OAuthProvider, 
  OAuthSession, 
  OAuthCallbackResult, 
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  OAuthConfig,
  OAuthAuthorizeRequest,
  OAuthAuthorizeResponse
} from "@app/shared";
import { createHonoClient } from "./hono-client";
import { validateSessionWithWorker } from "./oauth-session";
import { OAuthPopupHandler } from "./oauth-popup-handler";

/** Error types for better error handling */
export enum OAuthErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  POPUP_BLOCKED = 'POPUP_BLOCKED',
  POPUP_CLOSED = 'POPUP_CLOSED',
  CSRF_ERROR = 'CSRF_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  AUTHORIZATION_FAILED = 'AUTHORIZATION_FAILED',
  TOKEN_EXCHANGE_FAILED = 'TOKEN_EXCHANGE_FAILED',
  INVALID_RESPONSE = 'INVALID_RESPONSE'
}

/** Enhanced error class with context */
export class OAuthError extends Error {
  constructor(
    public type: OAuthErrorType,
    public userMessage: string,
    public technicalMessage: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(technicalMessage);
    this.name = 'OAuthError';
  }
}

/** Configuration for retry logic */
interface RetryConfig {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000 // 5 seconds
};

const REQUEST_TIMEOUT = 30000; // 30 seconds

export class OAuthClient {
  private readonly config: OAuthConfig;
  private readonly honoClient: ReturnType<typeof createHonoClient>;
  private readonly retryConfig: RetryConfig;
  // Store PKCE verifier and state parameter in memory for security
  private codeVerifier: string | null = null;
  private state: string | null = null;

  constructor(config: OAuthConfig, retryConfig?: Partial<RetryConfig>) {
    this.config = {
      ...config,
    };
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    // Create Hono client with the configured worker URL
    this.honoClient = createHonoClient(config.workerUrl);
  }

  /**
   * Enhanced logging with context
   */
  private log(level: 'info' | 'warn' | 'error', message: string, context?: Record<string, any>): void {
    const logData = {
      timestamp: new Date().toISOString(),
      provider: this.config.provider,
      workerUrl: this.config.workerUrl,
      ...context
    };
    
    // Remove sensitive data from logs
    const sanitizedData = { ...logData };
    delete sanitizedData.code_verifier;
    delete sanitizedData.code;
    delete sanitizedData.access_token;
    
    console[level](`[OAuthClient] ${message}`, sanitizedData);
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateRetryDelay(attempt: number): number {
    const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, attempt - 1);
    const jitterDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add 50% jitter
    return Math.min(jitterDelay, this.retryConfig.maxDelay);
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Check if it's an OAuthError with retryable flag
    if (error instanceof OAuthError && error.retryable) {
      return true;
    }
    
    // Network errors are retryable
    if (error?.name === 'TypeError' || error?.message?.includes('fetch')) {
      return true;
    }
    
    // Server errors 5xx are retryable
    if (error?.status >= 500 && error?.status < 600) {
      return true;
    }
    
    // Timeout errors are retryable
    if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
      return true;
    }
    
    return false;
  }

  /**
   * Enhanced fetch with timeout and error handling
   */
  private async fetchWithTimeout<T>(
    fetchFn: () => Promise<Response>,
    timeoutMs: number = REQUEST_TIMEOUT
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      const response = await fetchFn();
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (controller.signal.aborted) {
        throw new OAuthError(
          OAuthErrorType.TIMEOUT_ERROR,
          'Request timed out. Please check your connection and try again.',
          `Request timed out after ${timeoutMs}ms`,
          true,
          error as Error
        );
      }
      
      // Handle network errors
      if (error instanceof TypeError || (error as Error)?.message?.includes('fetch')) {
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          'Network connection failed. Please check your internet connection and try again.',
          (error as Error).message,
          true,
          error as Error
        );
      }
      
      throw error;
    }
  }

  /**
   * Retry wrapper with exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        this.log('info', `${operationName} attempt ${attempt}/${this.retryConfig.maxAttempts}`);
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        this.log('warn', `${operationName} attempt ${attempt} failed`, {
          error: lastError.message,
          retryable: this.isRetryableError(lastError)
        });
        
        // Don't retry if error is not retryable or this is the last attempt
        if (!this.isRetryableError(lastError) || attempt === this.retryConfig.maxAttempts) {
          break;
        }
        
        // Wait before retrying
        const delay = this.calculateRetryDelay(attempt);
        this.log('info', `Retrying ${operationName} in ${delay}ms`);
        await this.sleep(delay);
      }
    }
    
    // All retries failed
    this.log('error', `${operationName} failed after ${this.retryConfig.maxAttempts} attempts`, {
      finalError: lastError!.message
    });
    throw lastError!;
  }

  /**
   * Generate a random code verifier for PKCE
   */
  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Calculate code challenge from verifier for PKCE
   */
  private async calculateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  /**
   * Start OAuth authorization flow (popup mode only)
   */
  async startAuthFlow(): Promise<void> {
    try {
      this.log('info', 'Starting OAuth authorization flow');
      
      // Generate secure random state for CSRF protection
      const randomBytes = new Uint8Array(32);
      crypto.getRandomValues(randomBytes);
      this.state = btoa(String.fromCharCode(...randomBytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Generate PKCE code challenge on client side (will be sent to server)
      let codeVerifier: string;
      let codeChallenge: string;
      
      try {
        codeVerifier = this.generateCodeVerifier();
        codeChallenge = await this.calculateCodeChallenge(codeVerifier);
        this.codeVerifier = codeVerifier;
        this.log('info', 'Generated PKCE parameters successfully');
      } catch (error) {
        this.log('error', 'Failed to generate PKCE parameters', { error: (error as Error).message });
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          'Failed to prepare authentication. Please try again.',
          'PKCE parameter generation failed',
          false,
          error as Error
        );
      }

      // Call server's /oauth/authorize endpoint to get authorization URL
      const providerKey = this.config.provider.toLowerCase() as 'google' | 'github';
      let authorizeData: OAuthAuthorizeResponse;
      
      try {
        this.log('info', 'Requesting authorization URL from server', { provider: providerKey });
        
        const authorizeResponse = await this.withRetry(async () => {
          return this.fetchWithTimeout(() => 
            this.honoClient.oauth.authorize.$get({
              query: {
                code_challenge: codeChallenge,
                state: this.state!,
                provider: providerKey
              }
            })
          );
        }, 'OAuth authorize request');

        if (!authorizeResponse.ok) {
          const statusText = authorizeResponse.status === 400 ? 'Bad request' :
                           authorizeResponse.status === 401 ? 'Unauthorized' :
                           authorizeResponse.status === 403 ? 'Forbidden' :
                           authorizeResponse.status === 404 ? 'Not found' :
                           authorizeResponse.status >= 500 ? 'Server error' :
                           'Request failed';
                           
          throw new OAuthError(
            authorizeResponse.status >= 500 ? OAuthErrorType.SERVER_ERROR : OAuthErrorType.AUTHORIZATION_FAILED,
            `Authentication setup failed (${statusText}). Please try again.`,
            `Authorization endpoint returned status ${authorizeResponse.status}`,
            authorizeResponse.status >= 500
          );
        }

        try {
          authorizeData = (await authorizeResponse.json()) as OAuthAuthorizeResponse;
        } catch (parseError) {
          this.log('error', 'Failed to parse authorization response', { parseError: (parseError as Error).message });
          throw new OAuthError(
            OAuthErrorType.INVALID_RESPONSE,
            'Received invalid response from authentication server. Please try again.',
            'Failed to parse authorization response JSON',
            true,
            parseError as Error
          );
        }
        
      } catch (error) {
        if (error instanceof OAuthError) {
          throw error;
        }
        
        this.log('error', 'Authorization request failed', { error: (error as Error).message });
        
        // Determine error type and user message
        if (error instanceof TypeError || (error as Error)?.message?.includes('fetch')) {
          throw new OAuthError(
            OAuthErrorType.NETWORK_ERROR,
            'Network connection failed. Please check your internet connection and try again.',
            (error as Error).message,
            true,
            error as Error
          );
        }
        
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          'Authentication setup failed. Please try again.',
          (error as Error).message,
          false,
          error as Error
        );
      }
    
      if (!authorizeData.success) {
        this.log('error', 'OAuth authorization failed', { 
          error: authorizeData.error, 
          description: authorizeData.error_description 
        });
        
        // Map OAuth errors to user-friendly messages
        let userMessage = 'Authentication failed. Please try again.';
        if (authorizeData.error === 'invalid_client') {
          userMessage = 'Authentication configuration error. Please contact support.';
        } else if (authorizeData.error === 'invalid_request') {
          userMessage = 'Invalid authentication request. Please try again.';
        } else if (authorizeData.error === 'temporarily_unavailable') {
          userMessage = 'Authentication service is temporarily unavailable. Please try again later.';
        }
        
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          userMessage,
          `OAuth authorization error: ${authorizeData.error}: ${authorizeData.error_description}`,
          authorizeData.error === 'temporarily_unavailable'
        );
      }

      const authUrl = authorizeData.authorizationUrl;
      this.log('info', 'Got authorization URL, opening popup');

      // Use popup mode only
      const popupHandler = new OAuthPopupHandler();
      try {
        // Try to open popup
        try {
          popupHandler.openPopup(authUrl.toString());
        } catch (popupError) {
          this.log('error', 'Failed to open popup', { error: (popupError as Error).message });
          
          if (popupHandler.isPopupBlocked()) {
            throw new OAuthError(
              OAuthErrorType.POPUP_BLOCKED,
              'Popup was blocked by your browser. Please allow popups for this site and try again.',
              'Popup blocked by browser',
              false,
              popupError as Error
            );
          }
          
          throw new OAuthError(
            OAuthErrorType.POPUP_BLOCKED,
            'Failed to open authentication window. Please try again.',
            (popupError as Error).message,
            false,
            popupError as Error
          );
        }

        // Get the origin for message validation
        const callbackUrl = new URL(this.config.redirectUri);
        const allowedOrigin = callbackUrl.origin;

        // Wait for callback from popup with timeout
        let callbackData: any;
        try {
          this.log('info', 'Waiting for popup callback', { allowedOrigin });
          callbackData = await popupHandler.waitForCallback(allowedOrigin);
          this.log('info', 'Received popup callback');
        } catch (callbackError) {
          this.log('error', 'Popup callback failed', { error: (callbackError as Error).message });
          
          const errorMessage = (callbackError as Error).message;
          
          if (errorMessage.includes('closed without completing')) {
            throw new OAuthError(
              OAuthErrorType.POPUP_CLOSED,
              'Authentication was cancelled. Please try again if you want to sign in.',
              'Popup was closed by user',
              false,
              callbackError as Error
            );
          }
          
          if (errorMessage.includes('OAuth error')) {
            // Extract OAuth error details if available
            const userMessage = errorMessage.includes('access_denied') ? 
              'Authentication was denied. Please grant permission to continue.' :
              'Authentication failed. Please try again.';
              
            throw new OAuthError(
              OAuthErrorType.AUTHORIZATION_FAILED,
              userMessage,
              errorMessage,
              false,
              callbackError as Error
            );
          }
          
          throw new OAuthError(
            OAuthErrorType.AUTHORIZATION_FAILED,
            'Authentication failed. Please try again.',
            errorMessage,
            false,
            callbackError as Error
          );
        }

        // Validate state
        if (callbackData.state !== this.state) {
          this.log('error', 'State validation failed - possible CSRF attack', {
            expected: this.state?.substring(0, 10) + '...',
            received: callbackData.state?.substring(0, 10) + '...'
          });
          
          throw new OAuthError(
            OAuthErrorType.CSRF_ERROR,
            'Authentication security validation failed. Please try again.',
            'State mismatch - possible CSRF attack',
            false
          );
        }

        // Exchange code for tokens
        if (callbackData.code) {
          this.log('info', 'Exchanging authorization code for tokens');
          await this.exchangeCodeForTokens(callbackData.code, this.state);
          this.log('info', 'OAuth flow completed successfully');
        } else {
          this.log('error', 'No authorization code received in callback');
          throw new OAuthError(
            OAuthErrorType.AUTHORIZATION_FAILED,
            'Authentication failed - no authorization code received.',
            'Missing authorization code in callback',
            false
          );
        }
      } catch (error) {
        // Re-throw OAuthError instances as-is
        if (error instanceof OAuthError) {
          throw error;
        }
        
        // Handle popup-specific errors
        if (popupHandler.isPopupBlocked()) {
          throw new OAuthError(
            OAuthErrorType.POPUP_BLOCKED,
            'Popup was blocked by your browser. Please allow popups for this site and try again.',
            'Popup blocked by browser',
            false,
            error as Error
          );
        }
        
        this.log('error', 'Unexpected error in OAuth flow', { error: (error as Error).message });
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          'Authentication failed due to an unexpected error. Please try again.',
          (error as Error).message,
          false,
          error as Error
        );
      } finally {
        // Always clean up
        popupHandler.cleanup();
        this.clearMemory();
      }
    } catch (error) {
      // Log final error and clean up state
      if (error instanceof OAuthError) {
        this.log('error', 'OAuth flow failed', {
          type: error.type,
          userMessage: error.userMessage,
          retryable: error.retryable
        });
      } else {
        this.log('error', 'Unexpected error in OAuth flow', { error: (error as Error).message });
      }
      
      this.clearMemory();
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    state: string
  ): Promise<OAuthCallbackResult> {
    if (!this.codeVerifier) {
      this.log('error', 'Missing code verifier for token exchange');
      throw new OAuthError(
        OAuthErrorType.TOKEN_EXCHANGE_FAILED,
        'Authentication flow is invalid. Please start over.',
        'Missing code verifier',
        false
      );
    }

    // Create typed request body
    const requestBody: OAuthCallbackRequest = {
      code,
      state,
      code_verifier: this.codeVerifier,
      provider: this.config.provider as "google" | "github",
    };

    try {
      this.log('info', 'Exchanging authorization code for session');
      
      // Use retry logic for token exchange
      const response = await this.withRetry(async () => {
        return this.fetchWithTimeout(() => 
          this.honoClient.oauth.callback.$post({
            json: requestBody,
          })
        );
      }, 'OAuth token exchange');

      if (!response.ok) {
        const statusText = response.status === 400 ? 'Invalid request' :
                          response.status === 401 ? 'Unauthorized' :
                          response.status === 403 ? 'Access denied' :
                          response.status === 404 ? 'Endpoint not found' :
                          response.status >= 500 ? 'Server error' :
                          'Request failed';
                          
        this.log('error', 'Token exchange failed', { status: response.status, statusText });
        
        throw new OAuthError(
          response.status >= 500 ? OAuthErrorType.SERVER_ERROR : OAuthErrorType.TOKEN_EXCHANGE_FAILED,
          `Authentication completion failed (${statusText}). Please try again.`,
          `Token exchange endpoint returned status ${response.status}`,
          response.status >= 500
        );
      }

      let result: OAuthCallbackResponse;
      try {
        result = (await response.json()) as OAuthCallbackResponse;
      } catch (parseError) {
        this.log('error', 'Failed to parse token exchange response', { parseError: (parseError as Error).message });
        throw new OAuthError(
          OAuthErrorType.INVALID_RESPONSE,
          'Received invalid response from authentication server. Please try again.',
          'Failed to parse token exchange response JSON',
          true,
          parseError as Error
        );
      }

      // Use discriminated union to handle response
      if (!result.success) {
        this.log('error', 'Token exchange OAuth error', { 
          error: result.error, 
          description: result.error_description 
        });
        
        // Map OAuth errors to user-friendly messages
        let userMessage = 'Authentication completion failed. Please try again.';
        if (result.error === 'invalid_grant') {
          userMessage = 'Authentication code expired or invalid. Please try again.';
        } else if (result.error === 'invalid_client') {
          userMessage = 'Authentication configuration error. Please contact support.';
        } else if (result.error === 'invalid_request') {
          userMessage = 'Invalid authentication request. Please try again.';
        } else if (result.error === 'temporarily_unavailable') {
          userMessage = 'Authentication service is temporarily unavailable. Please try again later.';
        }
        
        throw new OAuthError(
          OAuthErrorType.TOKEN_EXCHANGE_FAILED,
          userMessage,
          `OAuth token exchange error: ${result.error}: ${result.error_description}`,
          result.error === 'temporarily_unavailable'
        );
      }
      
      this.log('info', 'Token exchange completed successfully');
      // Success - cookies are set by the backend automatically
      // Return the user data from the response
      return { 
        success: true, 
        sessionId: result.sessionId,
        user: result.user 
      };
      
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      
      this.log('error', 'Token exchange request failed', { error: (error as Error).message });
      
      // Handle network and other errors
      if (error instanceof TypeError || (error as Error)?.message?.includes('fetch')) {
        throw new OAuthError(
          OAuthErrorType.NETWORK_ERROR,
          'Network connection failed during authentication completion. Please check your internet connection and try again.',
          (error as Error).message,
          true,
          error as Error
        );
      }
      
      throw new OAuthError(
        OAuthErrorType.TOKEN_EXCHANGE_FAILED,
        'Authentication completion failed due to an unexpected error. Please try again.',
        (error as Error).message,
        false,
        error as Error
      );
    }
  }

  /**
   * Clear sensitive data from memory
   */
  private clearMemory(): void {
    this.codeVerifier = null;
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
    try {
      this.log('info', 'Handling OAuth callback');
      
      // This method is only for popup mode with provided PKCE params
      if (!codeVerifier || !state) {
        this.log('error', 'Missing PKCE parameters for callback handling');
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          "Authentication flow is invalid. Please start over.",
          "Missing required PKCE parameters. Popup mode requires codeVerifier and state.",
          false
        );
      }

      const params = callbackUrl.searchParams;
      const code = params.get("code");
      const callbackState = params.get("state");
      
      // Check for OAuth errors in the callback URL
      const error = params.get("error");
      const errorDescription = params.get("error_description");
      
      if (error) {
        this.log('error', 'OAuth callback contains error', { error, errorDescription });
        
        let userMessage = 'Authentication failed. Please try again.';
        if (error === 'access_denied') {
          userMessage = 'Authentication was denied. Please grant permission to continue.';
        } else if (error === 'invalid_request') {
          userMessage = 'Invalid authentication request. Please try again.';
        } else if (error === 'temporarily_unavailable') {
          userMessage = 'Authentication service is temporarily unavailable. Please try again later.';
        }
        
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          userMessage,
          `OAuth callback error: ${error}: ${errorDescription || 'Unknown error'}`,
          error === 'temporarily_unavailable'
        );
      }

      // Verify state
      if (callbackState !== state) {
        this.log('error', 'State validation failed in callback', {
          expected: state.substring(0, 10) + '...',
          received: callbackState?.substring(0, 10) + '...'
        });
        
        throw new OAuthError(
          OAuthErrorType.CSRF_ERROR,
          'Authentication security validation failed. Please try again.',
          'State mismatch - possible CSRF attack',
          false
        );
      }

      if (!code) {
        this.log('error', 'Missing authorization code in callback');
        throw new OAuthError(
          OAuthErrorType.AUTHORIZATION_FAILED,
          'Authentication failed - no authorization code received.',
          'Missing authorization code',
          false
        );
      }

      // Exchange code directly
      this.codeVerifier = codeVerifier;
      this.state = state;

      try {
        this.log('info', 'Exchanging callback authorization code');
        const result = await this.exchangeCodeForTokens(code, state);
        this.log('info', 'OAuth callback handling completed successfully');
        return result;
      } finally {
        this.clearMemory();
      }
      
    } catch (error) {
      this.clearMemory();
      
      if (error instanceof OAuthError) {
        this.log('error', 'OAuth callback handling failed', {
          type: error.type,
          userMessage: error.userMessage,
          retryable: error.retryable
        });
        throw error;
      }
      
      this.log('error', 'Unexpected error in callback handling', { error: (error as Error).message });
      throw new OAuthError(
        OAuthErrorType.AUTHORIZATION_FAILED,
        'Authentication callback handling failed. Please try again.',
        (error as Error).message,
        false,
        error as Error
      );
    }
  }

  /**
   * Validate current session with worker
   * Uses cookies for authentication (no sessionId needed)
   */
  async validateSession(): Promise<OAuthSession | null> {
    try {
      this.log('info', 'Validating current session');
      
      const session = await this.withRetry(async () => {
        return validateSessionWithWorker(this.config.workerUrl);
      }, 'Session validation');
      
      if (session) {
        this.log('info', 'Session validation successful', { 
          provider: session.provider,
          email: session.email?.substring(0, 3) + '***' // Partial masking for logging
        });
      } else {
        this.log('info', 'No valid session found');
      }
      
      return session;
      
    } catch (error) {
      this.log('error', 'Session validation failed', { error: (error as Error).message });
      
      // Session validation failures should not throw errors to the user
      // They just mean the user is not authenticated
      return null;
    }
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