// @agent: cloudflare-backend
/**
 * OAuth client type definitions
 */

export interface Env {
  // OAuth configuration
  GOOGLE_CLIENT_ID: string;
  CLIENT_ID: string; // For backwards compatibility
  REDIRECT_URI: string;
  FRONTEND_URL: string;
  
  // Security
  SESSION_ENCRYPTION_KEY: string;
  
  // CORS configuration
  ALLOWED_ORIGINS?: string; // Comma-separated list of allowed origins
  
  // KV Namespaces
  OAUTH_SESSIONS: KVNamespace;
  OAUTH_KV: KVNamespace; // Keep for backwards compatibility
  
  // Optional GitHub support for future
  GITHUB_CLIENT_ID?: string;
}