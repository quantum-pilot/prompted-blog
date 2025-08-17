// @agent: cloudflare-backend
/**
 * User information extraction from OAuth tokens
 */

import * as oauth from "oauth4webapi";

export interface UserInfo {
  provider: string;
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  expiresAt: number;
  state: string;
}

/**
 * Extract user information from validated ID token claims
 */
export function extractUserInfo(
  claims: oauth.IDToken,
  provider: string,
  state: string,
  expiresIn?: number
): UserInfo {
  return {
    provider,
    userId: claims.sub,
    email: claims.email as string,
    name: claims.name as string | undefined,
    picture: claims.picture as string | undefined,
    expiresAt: Date.now() + (expiresIn ?? 3600) * 1000,
    state,
  };
}
