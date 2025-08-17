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
