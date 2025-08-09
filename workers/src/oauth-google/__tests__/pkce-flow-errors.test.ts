// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index';
import { generateRandomString, generateCodeChallenge } from '../pkce';
import type { Env } from '../types';
import { createMockKV } from './test-helpers';

describe('PKCE Flow Error Handling and Compliance', () => {
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

  describe('Error Handling', () => {
    it('should handle missing PKCE parameters gracefully', async () => {
      const state = 'test-state';
      mockKV.get.mockResolvedValue(JSON.stringify({ timestamp: Date.now() }));
      global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing code_verifier parameter',
      }), { status: 400 }));
      const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(500);
    });

    it('should handle PKCE verification failure from Google', async () => {
      const state = 'test-state';
      mockKV.get.mockResolvedValue(JSON.stringify({
        codeVerifier: generateRandomString(64),
        timestamp: Date.now(),
      }));
      global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'The provided PKCE code verifier is incorrect',
      }), { status: 400 }));
      const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
      const response = await worker.fetch(request, env);
      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('internal_error');
    });

    it('should cleanup state after successful authentication', async () => {
      const state = 'test-state-cleanup';
      mockKV.get.mockResolvedValue(JSON.stringify({
        codeVerifier: generateRandomString(64),
        timestamp: Date.now(),
      }));
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
        })));
      const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
      await worker.fetch(request, env);
      expect(mockKV.delete).toHaveBeenCalledWith(`state:${state}`);
    });
  });

  describe('RFC 7636 Compliance', () => {
    it('should use S256 challenge method as required', async () => {
      const request = new Request('https://example.com/oauth/google/start');
      const response = await worker.fetch(request, env);
      const authUrl = new URL(response.headers.get('Location')!);
      expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should generate verifier with correct character set', () => {
      const verifier = generateRandomString(64);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/); // RFC 7636 unreserved chars
    });

    it('should generate verifier with correct length range', () => {
      const minVerifier = generateRandomString(43);
      const maxVerifier = generateRandomString(128);
      expect(minVerifier).toHaveLength(43);
      expect(maxVerifier).toHaveLength(128);
    });

    it('should encode challenge correctly', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'; // RFC 7636 test vector
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe(expectedChallenge);
    });
  });
});
