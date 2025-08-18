/**
 * Shared type definitions actually used by both frontend and worker
 */

// OAuth Provider enum (used by frontend)
export enum OAuthProvider {
  Google = "google",
  GitHub = "github",
}

// OAuth Session (used by both frontend and worker)
export interface OAuthSession {
  provider: string;
  email: string;
  name?: string;
  picture?: string;
  expiresAt: number;
}

// OAuth Callback Result (used by both frontend and worker)
export interface OAuthCallbackResult {
  success: boolean;
  error?: string;
  sessionId?: string;
}

// OAuth Client Configuration (used by frontend)
export interface OAuthConfig {
  workerUrl: string;
  clientId: string;
  redirectUri: string;
  provider: OAuthProvider;
}
