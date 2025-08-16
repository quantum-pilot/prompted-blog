// @agent: cloudflare-backend
/**
 * OAuth client type definitions
 */

export interface Env {
  // OAuth configuration
  GOOGLE_CLIENT_ID: string;
  REDIRECT_URI: string;

  // Security
  SESSION_ENCRYPTION_KEY: string;

  // CORS configuration
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins

  // KV Namespaces
  OAUTH_SESSIONS: KVNamespace;

  // Optional GitHub support for future
  GITHUB_CLIENT_ID?: string;
}
