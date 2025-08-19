/**
 * Shared Types Module
 * Central export for all shared type definitions
 */

// OAuth types
export type {
  OAuthAuthorizeRequest,
  OAuthAuthorizeSuccess,
  OAuthAuthorizeError,
  OAuthAuthorizeResponse,
  OAuthCallbackRequest,
  OAuthCallbackSuccess,
  OAuthCallbackError,
  OAuthCallbackResponse,
  OAuthConfig,
} from "./oauth";

// Session types
export type {
  OAuthSession,
  SessionValidationHeaders,
  SessionValidationSuccess,
  SessionValidationError,
  SessionValidationResponse,
  HealthCheckResponse,
  PKCEChallengeData,
} from "./session";

// Error types
export type {
  OAuthErrorCode,
  AppErrorCode,
  ErrorResponse,
  HTTPStatusCode,
} from "./error";

export { isErrorResponse, isOAuthCallbackSuccess } from "./error";
