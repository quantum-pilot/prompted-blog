// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { createMockEnv } from './test-helpers';

describe('Google OAuth Worker - PKCE Flow', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should successfully complete PKCE flow end-to-end', async () => {
    // Step 1: Initiate OAuth flow
    const startRequest = new Request('https://example.com/oauth/google/start');
    const startResponse = await worker.fetch(startRequest, env);

    expect(startResponse.status).toBe(302);
    const authUrl = new URL(startResponse.headers.get('Location')!);
    const state = authUrl.searchParams.get('state')!;
    const codeChallenge = authUrl.searchParams.get('code_challenge')!;

    // Verify PKCE parameters
    expect(codeChallenge).toBeTruthy();
    expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');

    // Get stored verifier from KV mock
    const [[, storedData]] = env.OAUTH_STATE.put.mock.calls;
    const { codeVerifier } = JSON.parse(storedData);

    // Step 2: Simulate callback with authorization code
    env.OAUTH_STATE.get.mockResolvedValue(storedData);

    // Mock successful token exchange with PKCE
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'pkce-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: 'pkce-id-token',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pkce-user-123',
        email: 'pkce@example.com',
        name: 'PKCE User',
        picture: 'https://example.com/pkce-photo.jpg',
      })));

    const callbackRequest = new Request(`https://example.com/oauth/google/callback?code=auth-code-123&state=${state}`);
    const callbackResponse = await worker.fetch(callbackRequest, env);

    expect(callbackResponse.status).toBe(302);

    // Verify token exchange used the correct code_verifier
    const tokenExchangeCall = (global.fetch as any).mock.calls[0];
    const tokenRequestBody = tokenExchangeCall[1].body;

    // Parse the URL-encoded body
    const params = new URLSearchParams(tokenRequestBody);
    expect(params.get('code_verifier')).toBe(codeVerifier);
    expect(params.get('code')).toBe('auth-code-123');
    expect(params.has('client_secret')).toBe(false);

    // Verify successful redirect with user data
    const redirectUrl = callbackResponse.headers.get('Location')!;
    expect(redirectUrl).toContain('/oauth/callback');
    expect(redirectUrl).toContain('user=');

    // Verify state was cleaned up
    expect(env.OAUTH_STATE.delete).toHaveBeenCalledWith(`state:${state}`);
  });

  it('should generate secure PKCE code verifier and challenge', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    await worker.fetch(request, env);

    const [[, storedData]] = env.OAUTH_STATE.put.mock.calls;
    const { codeVerifier } = JSON.parse(storedData);

    // Verifier should be at least 43 characters (256 bits base64url encoded)
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    // Should be a non-empty string
    expect(codeVerifier).toBeTruthy();
    expect(typeof codeVerifier).toBe('string');
  });
});
