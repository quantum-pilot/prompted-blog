import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker from '../index';
import { generateRandomString, generateCodeChallenge } from '../pkce';
import type { Env } from '../types';

/**
 * Comprehensive test suite for PKCE-only OAuth flow
 * Verifies that the OAuth implementation works without client_secret
 * and properly implements PKCE for security
 */
describe('PKCE-Only OAuth Flow Verification', () => {
  let env: Env;
  let mockKV: any;

  beforeEach(() => {
    mockKV = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
    };

    env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: mockKV,
    };

    vi.clearAllMocks();
  });

  describe('Security Requirements', () => {
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

  describe('PKCE Implementation', () => {
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
      const wrongVerifier = generateRandomString(64);
      
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
      
      // Test with wrong verifier - should fail
      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        codeVerifier: wrongVerifier,
        timestamp: Date.now(),
      }));
      
      global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'PKCE verification failed',
      }), { status: 400 }));
      
      const failRequest = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}-2`);
      const failResponse = await worker.fetch(failRequest, env);
      expect(failResponse.status).toBe(500);
    });
  });

  describe('State Management', () => {
    it('should cleanup state after successful authentication', async () => {
      const state = 'test-state-cleanup';
      
      mockKV.get.mockResolvedValue(JSON.stringify({
        codeVerifier: generateRandomString(64),
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
      
      expect(mockKV.delete).toHaveBeenCalledWith(`state:${state}`);
    });

    it('should handle expired state gracefully', async () => {
      const state = 'expired-state';
      
      // State expired 15 minutes ago
      mockKV.get.mockResolvedValue(JSON.stringify({
        codeVerifier: generateRandomString(64),
        timestamp: Date.now() - 15 * 60 * 1000,
      }));
      
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          access_token: 'test-token',
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'user-123',
        })));
      
      const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
      const response = await worker.fetch(request, env);
      
      // Should still work but log warning (check via console.error mock if needed)
      expect(response.status).toBe(302);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing PKCE parameters gracefully', async () => {
      const state = 'test-state';
      
      // Missing codeVerifier in state
      mockKV.get.mockResolvedValue(JSON.stringify({
        timestamp: Date.now(),
      }));
      
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
      
      // Google rejects the code_verifier
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
  });

  describe('Performance', () => {
    it('should complete PKCE generation within 50ms', async () => {
      const start = performance.now();
      
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
      expect(verifier).toBeTruthy();
      expect(challenge).toBeTruthy();
    });

    it('should complete full OAuth start flow within 50ms', async () => {
      const request = new Request('https://example.com/oauth/google/start');
      
      const start = performance.now();
      await worker.fetch(request, env);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    it('should complete OAuth callback validation within 50ms', async () => {
      const state = 'test-state';
      mockKV.get.mockResolvedValue(null); // Invalid state for quick validation
      
      const request = new Request(`https://example.com/oauth/google/callback?code=test&state=${state}`);
      
      const start = performance.now();
      await worker.fetch(request, env);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
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
      // RFC 7636: unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('should generate verifier with correct length range', () => {
      // RFC 7636: 43-128 characters
      const minVerifier = generateRandomString(43);
      const maxVerifier = generateRandomString(128);
      
      expect(minVerifier).toHaveLength(43);
      expect(maxVerifier).toHaveLength(128);
    });

    it('should encode challenge correctly', async () => {
      // RFC 7636 test vector
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe(expectedChallenge);
    });
  });
});