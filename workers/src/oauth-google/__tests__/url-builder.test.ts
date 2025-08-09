// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { buildAuthorizationUrl } from '../url-builder';
import type { Env } from '../types';

describe('URL Builder - PKCE Verification', () => {
  it('should include PKCE parameters in authorization URL', () => {
    const env: Env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: {} as any,
    };

    const state = 'test-state';
    const codeChallenge = 'test-challenge';

    const url = buildAuthorizationUrl(state, codeChallenge, env);
    const urlObj = new URL(url);

    // Verify PKCE parameters are present
    expect(urlObj.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(urlObj.searchParams.get('code_challenge_method')).toBe('S256');

    // Verify other required parameters
    expect(urlObj.searchParams.get('client_id')).toBe(env.CLIENT_ID);
    expect(urlObj.searchParams.get('redirect_uri')).toBe(env.REDIRECT_URI);
    expect(urlObj.searchParams.get('state')).toBe(state);
    expect(urlObj.searchParams.get('response_type')).toBe('code');

    // Verify client_secret is NOT in the authorization URL
    expect(urlObj.searchParams.has('client_secret')).toBe(false);
  });

  it('should work without CLIENT_SECRET in environment', () => {
    const env: Env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: {} as any,
      // CLIENT_SECRET is intentionally omitted
    };

    const state = 'test-state';
    const codeChallenge = 'test-challenge';

    // Should not throw error when CLIENT_SECRET is not provided
    const url = buildAuthorizationUrl(state, codeChallenge, env);
    expect(url).toBeTruthy();

    const urlObj = new URL(url);
    expect(urlObj.searchParams.get('code_challenge')).toBe(codeChallenge);
    expect(urlObj.searchParams.get('code_challenge_method')).toBe('S256');
  });
});
