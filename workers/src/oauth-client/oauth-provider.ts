// @agent: cloudflare-backend
/**
 * OAuth provider configuration
 */

import type { Env } from "./types";
import { OAUTH_PROVIDERS } from "../../../shared";
import { RequestContext } from "../utils/request-context";

export interface OAuthProviderConfig {
  name: string;
  authorizationServer: URL;
  authPath: string;
  clientId: string;
  redirectUri: string;
  scopes: readonly string[];
}

/**
 * Get OAuth provider configuration with dynamic redirect URI based on request host.
 * The redirect URI is determined from the request's Host header to support both
 * local development (localhost) and production (promptedblog.com).
 * 
 * Security: Even if Host header is spoofed, the OAuth provider (Google/GitHub)
 * will reject unauthorized redirect URIs that aren't in the app's allowed list.
 */
export function getProvider(provider: string, env: Env, context?: RequestContext): OAuthProviderConfig {
  const providerKey = provider as 'google' | 'github';
  const config = OAUTH_PROVIDERS[providerKey];
  
  if (!config) {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // Determine redirect URI from request host or fall back to production domain
  let redirectUri: string;
  
  if (context?.url) {
    const host = context.url.hostname;
    const port = context.url.port;
    
    // Check if it's localhost/development
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.endsWith('.local')) {
      // Use http for local development
      const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
      redirectUri = `http://${host}${portSuffix}/oauth/callback`;
    } else {
      // Use https for production/staging
      redirectUri = `https://${host}/oauth/callback`;
    }
  } else {
    // Fallback to production domain if no context provided
    redirectUri = 'https://promptedblog.com/oauth/callback';
  }
  
  return {
    name: config.name,
    authorizationServer: new URL(config.authServer),
    authPath: config.authPath,
    clientId: config.clientId,
    redirectUri,
    scopes: config.scopes,
  };
}
