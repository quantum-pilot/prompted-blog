/**
 * Error Response Types
 * Discriminated union types for API errors
 */

// ===========================
// OAuth Error Codes
// ===========================

export type OAuthErrorCode =
  | "invalid_request"
  | "invalid_grant"
  | "invalid_client"
  | "unauthorized_client"
  | "unsupported_response_type"
  | "invalid_scope"
  | "server_error"
  | "temporarily_unavailable";

// ===========================
// Application Error Codes
// ===========================

export type AppErrorCode =
  | "authentication_failed"
  | "session_expired"
  | "session_not_found"
  | "invalid_session_format"
  | "rate_limit_exceeded"
  | "csrf_detected"
  | "pkce_verification_failed"
  | "not_found"
  | "internal_error";

// ===========================
// Base Error Response
// ===========================

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: OAuthErrorCode | AppErrorCode | string;
  error_description: string;
  timestamp?: number;
  request_id?: string;
}

// ===========================
// HTTP Status Codes
// ===========================

// Import from api module where HttpStatus is defined
import { HttpStatus } from "../api/http";

export type HTTPStatusCode = HttpStatus;

// ===========================
// Type Guards
// ===========================

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === "object" &&
    response !== null &&
    "error" in response &&
    "error_description" in response
  );
}

/**
 * Type guard for OAuth callback success
 */
export function isOAuthCallbackSuccess(
  response: unknown
): response is { success: true; sessionId: string } {
  return (
    typeof response === "object" &&
    response !== null &&
    "success" in response &&
    (response as any).success === true &&
    "sessionId" in response
  );
}
