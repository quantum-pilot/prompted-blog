/**
 * Shared API Module
 * Centralized exports for API endpoints and utilities
 */

// OAuth endpoints and utilities
export {
  OAUTH_ENDPOINTS,
  type OAuthProvider,
  buildAuthorizeUrl,
  buildCallbackUrl,
  buildSessionUrl,
  buildProviderAuthUrl,
  parseCallbackParams,
  validateCallbackRequest,
} from "./oauth";

// HTTP utilities
export {
  HttpMethod,
  ContentType,
  HttpStatus,
  buildApiHeaders,
  buildSecurityHeaders,
  buildCorsHeaders,
} from "./http";

// Health check endpoint
export const HEALTH_ENDPOINT = "/health" as const;
