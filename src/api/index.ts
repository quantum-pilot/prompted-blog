/**
 * API Client Module
 * Exports typed API clients and utilities
 */

// Main OAuth client with popup support
export { OAuthClient } from "./oauth-client";

// OAuth types
export {
  OAuthProvider,
  type OAuthConfig,
  type OAuthSession,
  type OAuthCallbackResult,
  type ProviderConfig,
} from "./oauth-types";

// OAuth popup handler for secure in-memory PKCE
export { OAuthPopupHandler } from "./oauth-popup-handler";
export type { PopupCallbackData } from "./oauth-popup-handler";

// Provider configuration
export { getProviderConfig } from "./oauth-providers";

// Session management (in-memory only, no sessionStorage)
export {
  storeSessionId,
  getSessionId,
  clearSessionId,
  validateSessionWithWorker,
  clearOAuthData,
} from "./oauth-session";
