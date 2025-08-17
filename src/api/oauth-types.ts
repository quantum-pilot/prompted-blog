/**
 * OAuth types for frontend
 * Re-exports only what's needed from shared module
 */

export { OAuthProvider, OAuthSession } from "@app/shared";

// Frontend-specific types that aren't shared
export interface OAuthConfig {
  workerUrl: string;
  clientId: string;
  redirectUri: string;
  provider: OAuthProvider;
  scopes?: string[];
}

export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

export interface ProviderConfig {
  authorizationEndpoint: string;
  scopes: readonly string[];
  additionalParams?: Record<string, string>;
}
