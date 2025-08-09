// @agent: cloudflare-backend
// URL building utilities for OAuth flow
import type { Env } from './types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v1/userinfo';

export function buildAuthorizationUrl(
  state: string,
  codeChallenge: string,
  env: Env
): string {
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set('client_id', env.CLIENT_ID);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('redirect_uri', env.REDIRECT_URI);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');

  return url.toString();
}

export function getTokenUrl(): string {
  return GOOGLE_TOKEN_URL;
}

export function getUserInfoUrl(): string {
  return GOOGLE_USERINFO_URL;
}

export function buildRedirectUrl(userData: any, env: Env): string {
  // Determine app URL based on environment
  const appUrl = env.REDIRECT_URI.includes('localhost')
    ? 'http://localhost:8000'
    : 'https://promptedblog.com';

  const redirectUrl = new URL('/oauth/callback', appUrl);
  redirectUrl.searchParams.set('user', encodeURIComponent(JSON.stringify(userData)));

  return redirectUrl.toString();
}
