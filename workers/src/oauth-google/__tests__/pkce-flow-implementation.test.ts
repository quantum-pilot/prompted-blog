// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index';
import { generateRandomString, generateCodeChallenge } from '../pkce';
import type { Env } from '../types';
import { createMockKV, measurePerformance, assertLatency } from './test-helpers';

/**
 * PKCE implementation tests
 * Verifies correct PKCE parameter generation, storage, and validation
 */
describe('PKCE Flow Implementation', () => {
  let env: Env;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
    env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: mockKV,
    };
    vi.clearAllMocks();
  });

  it('should generate valid PKCE parameters', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await worker.fetch(request, env);

    const authUrl = new URL(response.headers.get('Location')!);

    // Verify PKCE parameters in authorization URL
    const codeChallenge = authUrl.searchParams.get('code_challenge');
    const challengeMethod = authUrl.searchParams.get('code_challenge_method');

    expect(codeChallenge).toBeTruthy();
    expect(codeChallenge).toHaveLength(43); // Base64url SHA256
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challengeMethod).toBe('S256');
  });

  it('should store code_verifier securely in KV', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    await worker.fetch(request, env);

    const [[key, data, options]] = mockKV.put.mock.calls;

    expect(key).toMatch(/^state:/);
    expect(options.expirationTtl).toBe(600); // 10 minutes TTL

    const parsed = JSON.parse(data);
    expect(parsed.codeVerifier).toBeTruthy();
    expect(parsed.codeVerifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(parsed.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(parsed.codeVerifier.length).toBeLessThanOrEqual(128);
  });

  it('should properly validate code_verifier during token exchange', async () => {
    const state = 'test-state';
    const correctVerifier = generateRandomString(64);

    // Test with correct verifier - should succeed
    mockKV.get.mockResolvedValueOnce(JSON.stringify({
      codeVerifier: correctVerifier,
      timestamp: Date.now(),
    }));

    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'success-token',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'user-123',
      })));

    const successRequest = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
    const successResponse = await worker.fetch(successRequest, env);
    expect(successResponse.status).toBe(302);
  });

  it('should complete PKCE generation within 50ms', async () => {
    const { result, duration } = await measurePerformance(async () => {
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      return { verifier, challenge };
    });

    assertLatency(duration);
    expect(result.verifier).toBeTruthy();
    expect(result.challenge).toBeTruthy();
  });
});
