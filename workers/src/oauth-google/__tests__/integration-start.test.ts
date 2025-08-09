// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { createMockEnv } from './test-helpers';

describe('Google OAuth Worker - /oauth/google/start Endpoint', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
    env.REDIRECT_URI = 'https://example.com/oauth/google/callback';
  });

  it('should initiate OAuth flow with PKCE', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toBeTruthy();

    const url = new URL(location!);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.pathname).toBe('/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('openid email profile');
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/oauth/google/callback');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  it('should store PKCE verifier and state in KV', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await worker.fetch(request, env);

    expect(env.OAUTH_STATE.put).toHaveBeenCalled();
    const [[stateKey, stateData, options]] = env.OAUTH_STATE.put.mock.calls;
    expect(stateKey).toMatch(/^state:/);

    const parsedData = JSON.parse(stateData);
    expect(parsedData.codeVerifier).toBeTruthy();
    expect(parsedData.timestamp).toBeTruthy();

    // Verify TTL is set for state cleanup
    expect(options.expirationTtl).toBe(600); // 10 minutes

    // Verify relationship between state in URL and KV key
    const location = response.headers.get('Location')!;
    const url = new URL(location);
    const urlState = url.searchParams.get('state');
    expect(stateKey).toBe(`state:${urlState}`);
  });

  it('should not include client_secret in OAuth URL', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await worker.fetch(request, env);

    const location = response.headers.get('Location')!;
    const url = new URL(location);

    // Verify client_secret is NOT in the authorization URL
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(location).not.toContain('client_secret');
  });

  it('should generate unique state for each request', async () => {
    const request1 = new Request('https://example.com/oauth/google/start');
    const response1 = await worker.fetch(request1, env);
    const state1 = new URL(response1.headers.get('Location')!).searchParams.get('state');

    const request2 = new Request('https://example.com/oauth/google/start');
    const response2 = await worker.fetch(request2, env);
    const state2 = new URL(response2.headers.get('Location')!).searchParams.get('state');

    expect(state1).toBeTruthy();
    expect(state2).toBeTruthy();
    expect(state1).not.toBe(state2);
  });

  it('should generate valid PKCE code challenge', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await worker.fetch(request, env);

    const location = response.headers.get('Location')!;
    const url = new URL(location);
    const codeChallenge = url.searchParams.get('code_challenge');

    // Code challenge should be base64url encoded
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // Should be 43 characters long (256 bits / 6 bits per char = ~43)
    expect(codeChallenge!.length).toBeGreaterThanOrEqual(43);
  });
});
