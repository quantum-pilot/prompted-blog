// @agent: cloudflare-backend
/**
 * OAuth provider configuration
 */

import type { Env } from "./types";
import { OAUTH_SCOPES, OAUTH_PROVIDERS } from "../../../shared";

export interface OAuthProviderConfig {
  name: string;
  authorizationServer: URL;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export function getGoogleProvider(env: Env): OAuthProviderConfig {
  return {
    name: OAUTH_PROVIDERS.google.name,
    authorizationServer: new URL("https://accounts.google.com"),
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.REDIRECT_URI,
    scopes: [...OAUTH_SCOPES.GOOGLE],
  };
}
