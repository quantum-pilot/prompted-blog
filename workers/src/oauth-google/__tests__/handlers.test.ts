import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env } from '../types';
import { handleOAuthStart, handleOAuthCallback } from '../handlers';

describe('OAuth Handlers', () => {
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

  describe('handleOAuthStart', () => {
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

      expect(mockKV.put).toHaveBeenCalledTimes(1);
      const [[key, data, options]] = mockKV.put.mock.calls;

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

      const [[key, data]] = mockKV.put.mock.calls;
      expect(key).toBe(`state:${state}`);

      const parsed = JSON.parse(data);
      // PKCE verifier should be 43-128 characters long
      expect(parsed.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(parsed.codeVerifier.length).toBeLessThanOrEqual(128);
      // Should only contain unreserved characters
      expect(parsed.codeVerifier).toMatch(/^[A-Za-z0-9._~-]+$/);
    });

    it('should handle errors gracefully', async () => {
      mockKV.put.mockRejectedValueOnce(new Error('KV error'));

      const response = await handleOAuthStart(env);

      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('internal_error');
    });

    it('should complete within 50ms', async () => {
      const start = performance.now();
      await handleOAuthStart(env);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('handleOAuthCallback', () => {
    const mockUrl = (params: Record<string, string>) => {
      const url = new URL('https://example.com/oauth/google/callback');
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
      return url;
    };

    it('should handle OAuth errors', async () => {
      const url = mockUrl({
        error: 'access_denied',
        error_description: 'User denied'
      });

      const response = await handleOAuthCallback(url, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('access_denied');
    });

    it('should validate required parameters', async () => {
      const url = mockUrl({});

      const response = await handleOAuthCallback(url, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('missing_code');
    });

    it('should validate state parameter', async () => {
      const url = mockUrl({ code: 'test-code' });

      const response = await handleOAuthCallback(url, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('missing_state');
    });

    it('should handle invalid state', async () => {
      mockKV.get.mockResolvedValueOnce(null);
      const url = mockUrl({ code: 'test-code', state: 'invalid' });

      const response = await handleOAuthCallback(url, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_state');
    });

    it('should complete within 50ms for validation errors', async () => {
      const url = mockUrl({});

      const start = performance.now();
      await handleOAuthCallback(url, env);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should successfully exchange code with valid PKCE verifier', async () => {
      const state = 'test-state-123';
      const codeVerifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
      
      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        codeVerifier,
        timestamp: Date.now(),
      }));

      // Mock successful token exchange
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          access_token: 'test-token',
          token_type: 'Bearer',
          expires_in: 3600,
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
        })));

      const url = mockUrl({ code: 'test-code', state });
      const response = await handleOAuthCallback(url, env);

      expect(response.status).toBe(302);
      
      // Verify the token exchange included the code_verifier
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = fetchCall[1].body;
      
      // Parse the URL-encoded body
      const params = new URLSearchParams(requestBody);
      expect(params.get('code_verifier')).toBe(codeVerifier);
      expect(params.get('code')).toBe('test-code');
      expect(params.has('client_secret')).toBe(false);
    });

    it('should handle expired state gracefully', async () => {
      const state = 'expired-state';
      
      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        codeVerifier: 'test-verifier',
        timestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago
      }));

      const url = mockUrl({ code: 'test-code', state });
      const response = await handleOAuthCallback(url, env);

      // Should still proceed but log warning
      expect(mockKV.get).toHaveBeenCalledWith(`state:${state}`);
    });

    it('should clean up state after successful callback', async () => {
      const state = 'test-state-cleanup';
      
      mockKV.get.mockResolvedValueOnce(JSON.stringify({
        codeVerifier: 'test-verifier',
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

      const url = mockUrl({ code: 'test-code', state });
      await handleOAuthCallback(url, env);

      expect(mockKV.delete).toHaveBeenCalledWith(`state:${state}`);
    });
  });
});
