// @agent: cloudflare-backend
/**
 * OAuth provider utilities for @cloudflare/workers-oauth-provider library
 * Provides helper functions for OAuth client configuration and management
 */
import { googleOAuthConfig } from './config';
import type { Env } from './types';

export interface OAuthEnvironment {
  CLIENT_ID: string;
  REDIRECT_URI: string;
  SESSION_ENCRYPTION_KEY: string;
  OAUTH_SESSIONS: KVNamespace;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: any;
}

/**
 * Creates OAuth client configuration for registration with the provider
 */
export function createClientConfig(env: OAuthEnvironment) {
  return {
    client_id: env.CLIENT_ID,
    redirect_uris: [env.REDIRECT_URI],
    client_name: 'Google OAuth Client',
    scope: googleOAuthConfig.scopes.join(' '),
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none' // PKCE flow doesn't require client secret
  };
}

/**
 * Registers OAuth client with the provider if it doesn't exist
 */
export async function ensureClientRegistered(env: OAuthEnvironment): Promise<void> {
  try {
    // Check if client already exists
    await env.OAUTH_PROVIDER.lookupClient(env.CLIENT_ID);
  } catch (error) {
    // Client doesn't exist, register it
    const clientConfig = createClientConfig(env);
    await env.OAUTH_PROVIDER.createClient(clientConfig);
    console.log(`OAuth client registered: ${env.CLIENT_ID}`);
  }
}

/**
 * Handles OAuth authorization completion using provider helpers
 */
export async function completeOAuthAuthorization(
  oauthRequest: any,
  env: OAuthEnvironment
): Promise<string> {
  // Auto-approve for now - in production, would show consent UI
  const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthRequest,
    userId: `google-user-${Date.now()}`,
    metadata: {
      provider: 'google',
      timestamp: Date.now(),
      clientId: oauthRequest.clientId
    },
    scope: googleOAuthConfig.scopes,
    props: {
      clientId: oauthRequest.clientId,
      provider: 'google',
      email: `user@${oauthRequest.clientId}.com`
    }
  });

  return redirectTo;
}
