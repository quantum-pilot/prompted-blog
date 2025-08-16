// @agent: cloudflare-backend
/**
 * OAuth provider configuration
 */

import type { Env } from './types';

export interface OAuthProvider {
  name: string;
  authorizationServer: URL;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export function getGoogleProvider(env: Env): OAuthProvider {
  return {
    name: 'google',
    authorizationServer: new URL('https://accounts.google.com'),
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.REDIRECT_URI,
    scopes: ['openid', 'email', 'profile']
  };
}
