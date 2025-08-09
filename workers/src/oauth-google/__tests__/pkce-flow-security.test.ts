// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index';
import { generateRandomString } from '../pkce';
import type { Env } from '../types';
import { createMockKV } from './test-helpers';

/**
 * Security-focused tests for PKCE-only OAuth flow
 * Verifies that client_secret is never used and PKCE is properly implemented
 */
describe('PKCE Flow Security Requirements', () => {
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

  it('should NEVER include client_secret in any OAuth operations', async () => {
    // Start OAuth flow
    const startRequest = new Request('https://example.com/oauth/google/start');
    const startResponse = await worker.fetch(startRequest, env);

    // Check authorization URL has no client_secret
    const authUrl = startResponse.headers.get('Location')!;
    expect(authUrl).not.toContain('client_secret');

    // Simulate callback
    const state = new URL(authUrl).searchParams.get('state')!;
    const [[, storedData]] = mockKV.put.mock.calls;
    mockKV.get.mockResolvedValue(storedData);

    // Mock token exchange
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      access_token: 'test-token',
    })));

    const callbackRequest = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
    await worker.fetch(callbackRequest, env);

    // Verify token exchange has no client_secret
    const tokenCall = (global.fetch as any).mock.calls[0];
    const tokenBody = new URLSearchParams(tokenCall[1].body);
    expect(tokenBody.has('client_secret')).toBe(false);
  });

  it('should use PKCE code_verifier instead of client_secret', async () => {
    const state = 'test-state';
    const codeVerifier = generateRandomString(64);

    mockKV.get.mockResolvedValue(JSON.stringify({
      codeVerifier,
      timestamp: Date.now(),
    }));

    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'test-token',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'user-123',
        email: 'test@example.com',
      })));

    const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
    await worker.fetch(request, env);

    const tokenCall = (global.fetch as any).mock.calls[0];
    const tokenBody = new URLSearchParams(tokenCall[1].body);

    // Verify PKCE is used instead of client_secret
    expect(tokenBody.get('code_verifier')).toBe(codeVerifier);
    expect(tokenBody.has('client_secret')).toBe(false);
  });
});
