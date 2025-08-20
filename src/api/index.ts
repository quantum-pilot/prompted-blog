/**
 * API Client Module
 * Exports typed API clients and utilities
 */

// Main OAuth client with popup support
export { OAuthClient } from "./oauth-client";

// OAuth types - re-export from shared for convenience
export {
  OAuthProvider,
  type OAuthConfig,
  type OAuthSession,
  type OAuthCallbackResult,
} from "@app/shared";

// OAuth popup handler for secure in-memory PKCE
export { OAuthPopupHandler } from "./oauth-popup-handler";
export type { PopupCallbackData } from "./oauth-popup-handler";

// Session management (in-memory only, no sessionStorage)
export {
  storeSessionId,
  getSessionId,
  clearSessionId,
  validateSessionWithWorker,
  clearOAuthData,
} from "./oauth-session";

// Profile API client for user profile operations
export { ProfileClient } from "./profile-client";

// Profile types - re-export from shared for convenience
export type {
  UserAccount,
  GetUserResponse,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
  CheckUsernameAvailabilityRequest,
  CheckUsernameAvailabilityResponse,
} from "@app/shared/contracts";
