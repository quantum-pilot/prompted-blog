// @agent: cloudflare-backend
/**
 * OAuth client type definitions for worker
 */

// Extend the generated Cloudflare.Env interface
// Cloudflare.Env already includes: OAUTH_SESSIONS, GOOGLE_CLIENT_SECRET, SESSION_ENCRYPTION_KEY, SESSION_ENCRYPTION_SALT
export interface Env extends Cloudflare.Env {
  ALLOWED_ORIGINS: string;
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
