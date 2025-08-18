// @agent: cloudflare-backend
/**
 * OAuth provider configuration
 */

import type { Env } from "./types";
import { OAUTH_PROVIDERS, getRedirectUri } from "../../../shared";

export interface OAuthProviderConfig {
  name: string;
  authorizationServer: URL;
  authPath: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
}

export function getProvider(provider: string, env: Env): OAuthProviderConfig {
  const providerKey = provider as 'google' | 'github';
  const config = OAUTH_PROVIDERS[providerKey];
  
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  return {
    name: config.name,
    authorizationServer: new URL(config.authServer),
    authPath: config.authPath,
    clientId: config.clientId,
    redirectUri: getRedirectUri(),
    scopes: config.scopes,
  };
}
