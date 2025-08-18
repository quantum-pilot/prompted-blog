// @agent: cloudflare-backend
/**
 * OAuth client type definitions for worker
 */

import { OAuthCallbackResult } from "../../../shared";

// Extend WorkerEnv to properly type KVNamespace
export interface Env {
  ALLOWED_ORIGINS: string;
  OAUTH_SESSIONS: KVNamespace;
  SESSION_ENCRYPTION_KEY: string;
  SESSION_ENCRYPTION_SALT: string;
}

// Re-export shared types for convenience
export type { OAuthCallbackResult };

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
