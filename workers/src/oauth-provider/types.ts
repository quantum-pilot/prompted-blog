// @agent: cloudflare-backend
import type { KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REDIRECT_URI: string;
  SESSION_ENCRYPTION_KEY: string; // Cloudflare secret for persistent encryption
  OAUTH_SESSIONS: KVNamespace; // Required for secure session storage
  OAUTH_KV: KVNamespace; // OAuth provider library storage (required by @cloudflare/workers-oauth-provider)
  OAUTH_PROVIDER: any; // OAuth provider instance injected by library
}

export interface StateData {
  codeVerifier: string;
  timestamp: number;
}

export interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email?: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture: string;
  locale?: string;
}

export interface StandardizedUser {
  id: string;
  email: string;
  name: string;
  picture: string;
  provider: 'google';
}

export interface OAuthSuccessResponse {
  success: true;
  user: StandardizedUser;
  tokens?: {
    access_token: string;
    expires_in: number;
  };
}

export interface OAuthErrorResponse {
  error: string;
  error_description?: string;
  message?: string;
}
