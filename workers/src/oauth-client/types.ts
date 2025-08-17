// @agent: cloudflare-backend
/**
 * OAuth client type definitions for worker
 */

// Extend WorkerEnv to properly type KVNamespace
export interface Env {
  ALLOWED_ORIGINS: string;
  OAUTH_SESSIONS: KVNamespace;
  SESSION_ENCRYPTION_KEY: string;
  SESSION_ENCRYPTION_SALT: string;
  GOOGLE_CLIENT_ID: string;
  CLIENT_ID: string;
  REDIRECT_URI: string;
  FRONTEND_URL: string;
  OAUTH_KV?: KVNamespace; // Optional, for legacy support
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
