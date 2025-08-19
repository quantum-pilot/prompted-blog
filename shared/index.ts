/**
 * Shared module exports
 * Central export point for all shared constants, types, API utilities, and contracts
 */

// Export all constants (OAuth providers, app config, helper functions)
export * from "./constants";

// Export all types from the new types folder
export * from "./types/index";

// Export all API utilities from the new api folder (except OAuthProvider to avoid conflict)
export {
  // OAuth endpoints and utilities
  OAUTH_ENDPOINTS,
  buildAuthorizeUrl,
  buildCallbackUrl,
  buildSessionUrl,
  buildProviderAuthUrl,
  parseCallbackParams,
  validateCallbackRequest,
  // HTTP utilities
  HttpMethod,
  ContentType,
  HttpStatus,
  buildApiHeaders,
  buildSecurityHeaders,
  buildCorsHeaders,
  // Health check endpoint
  HEALTH_ENDPOINT,
} from "./api/index";

// Export OAuthProvider type explicitly from api (not the enum)
export type { OAuthProvider as OAuthProviderType } from "./api/index";

// Export backward compatibility layer (includes OAuthProvider enum)
export * from "./types";

// Export contract schemas for contract-first API development
export * from "./contracts/index";
