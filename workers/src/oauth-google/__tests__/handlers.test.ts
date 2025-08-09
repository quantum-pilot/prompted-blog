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
      CLIENT_SECRET: 'test-client-secret',
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
  });
});