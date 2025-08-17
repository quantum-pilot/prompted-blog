// @agent: cloudflare-backend
/**
 * OAuth client type definitions for worker
 */

// Extend WorkerEnv to properly type KVNamespace
export interface Env {
  ALLOWED_ORIGINS: string;
  OAUTH_SESSIONS: KVNamespace;
}

// Worker-specific types not in shared module
export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

export interface ProviderConfig {
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: readonly string[];
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

export interface OAuthUserInfo {
  email: string;
  name?: string;
  picture?: string;
}
