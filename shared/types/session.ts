/**
 * Session Types
 * Types for session management and validation
 */

// ===========================
// Session Data
// ===========================

/**
 * OAuth session data stored in KV
 */
export interface OAuthSession {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  provider: "google" | "github";
  createdAt: number;
  expiresAt: number;
  state: string;
}

// ===========================
// Session Validation Endpoint
// ===========================

/**
 * Request headers for /oauth/session endpoint
 */
export interface SessionValidationHeaders {
  Authorization: string; // Bearer <sessionId>
}

/**
 * Successful response from /oauth/session endpoint
 */
export interface SessionValidationSuccess {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  provider: "google" | "github";
  expiresAt: number;
}

/**
 * Error response from /oauth/session endpoint
 */
export interface SessionValidationError {
  error: string;
  error_description: string;
}

export type SessionValidationResponse =
  | SessionValidationSuccess
  | SessionValidationError;

// ===========================
// Health Check Endpoint
// ===========================

/**
 * Response from /health endpoint
 */
export interface HealthCheckResponse {
  status: "ok";
  timestamp: number;
}

// ===========================
// Internal Session Types
// ===========================

/**
 * PKCE challenge data stored temporarily during OAuth flow
 */
export interface PKCEChallengeData {
  challenge: string;
  state: string;
  provider: string;
  createdAt: number;
  expiresAt: number;
}
