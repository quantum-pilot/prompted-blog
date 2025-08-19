/**
 * OAuth Flow Request/Response Types
 * Strict types with discriminated unions for OAuth authentication
 */

// ===========================
// OAuth Authorize Endpoint
// ===========================

/**
 * Request parameters for /oauth/authorize endpoint
 */
export interface OAuthAuthorizeRequest {
  code_challenge: string;
  state: string;
  provider: "google" | "github";
}

/**
 * Successful response from /oauth/authorize endpoint
 */
export interface OAuthAuthorizeSuccess {
  success: true;
  authorizationUrl: string;
}

/**
 * Error response from /oauth/authorize endpoint
 */
export interface OAuthAuthorizeError {
  success: false;
  error: string;
  error_description: string;
}

export type OAuthAuthorizeResponse =
  | OAuthAuthorizeSuccess
  | OAuthAuthorizeError;

// ===========================
// OAuth Callback Endpoint
// ===========================

/**
 * Request body for /oauth/callback endpoint
 */
export interface OAuthCallbackRequest {
  code: string;
  state: string;
  code_verifier: string;
  provider: "google" | "github";
}

/**
 * Successful response from /oauth/callback endpoint
 */
export interface OAuthCallbackSuccess {
  success: true;
  sessionId: string;
  user: {
    email: string;
    name?: string;
    picture?: string;
  };
}

/**
 * Error response from /oauth/callback endpoint
 */
export interface OAuthCallbackError {
  success: false;
  error: string;
  error_description: string;
}

export type OAuthCallbackResponse = OAuthCallbackSuccess | OAuthCallbackError;

// ===========================
// OAuth Client Configuration
// ===========================

/**
 * OAuth client configuration
 */
export interface OAuthConfig {
  provider: "google" | "github";
  clientId: string;
  redirectUri: string;
  workerUrl: string;
}
