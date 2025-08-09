// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env } from '../types';
import { handleOAuthStart } from '../handlers';
import { createMockEnv, measurePerformance, assertLatency } from './test-helpers';

describe('handleOAuthStart', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
    vi.clearAllMocks();
  });

  it('should generate auth URL with PKCE parameters', async () => {
    const response = await handleOAuthStart(env);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toBeTruthy();

    const url = new URL(location!);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');

    // Verify code_challenge is base64url encoded
    const codeChallenge = url.searchParams.get('code_challenge')!;
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    // Standard PKCE code challenge length should be 43 characters (base64url of SHA256)
    expect(codeChallenge.length).toBe(43);
  });

  it('should generate unique PKCE parameters for each request', async () => {
    const response1 = await handleOAuthStart(env);
    const response2 = await handleOAuthStart(env);

    const location1 = response1.headers.get('Location')!;
    const location2 = response2.headers.get('Location')!;

    const url1 = new URL(location1);
    const url2 = new URL(location2);

    // Verify different state and code_challenge values
    expect(url1.searchParams.get('state')).not.toBe(url2.searchParams.get('state'));
    expect(url1.searchParams.get('code_challenge')).not.toBe(url2.searchParams.get('code_challenge'));
  });

  it('should store state in KV', async () => {
    await handleOAuthStart(env);

    expect(env.OAUTH_STATE.put).toHaveBeenCalledTimes(1);
    const [[key, data, options]] = (env.OAUTH_STATE.put as any).mock.calls;

    expect(key).toMatch(/^state:/);
    expect(options.expirationTtl).toBe(600);

    const parsed = JSON.parse(data);
    expect(parsed.codeVerifier).toBeTruthy();
    expect(parsed.timestamp).toBeTruthy();
  });

  it('should store valid PKCE verifier in KV', async () => {
    const response = await handleOAuthStart(env);
    const location = response.headers.get('Location')!;
    const url = new URL(location);
    const state = url.searchParams.get('state')!;

    const [[key, data]] = (env.OAUTH_STATE.put as any).mock.calls;
    expect(key).toBe(`state:${state}`);

    const parsed = JSON.parse(data);
    // PKCE verifier should be 43-128 characters long
    expect(parsed.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(parsed.codeVerifier.length).toBeLessThanOrEqual(128);
    // Should only contain unreserved characters
    expect(parsed.codeVerifier).toMatch(/^[A-Za-z0-9._~-]+$/);
  });

  it('should handle errors gracefully', async () => {
    (env.OAUTH_STATE.put as any).mockRejectedValueOnce(new Error('KV error'));

    const response = await handleOAuthStart(env);

    expect(response.status).toBe(500);
    const data = await response.json() as any;
    expect(data.error).toBe('internal_error');
  });

  it('should complete within 50ms', async () => {
    const { duration } = await measurePerformance(() => handleOAuthStart(env));
    assertLatency(duration, 50);
  });
});
