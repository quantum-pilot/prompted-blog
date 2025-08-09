import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';

describe('Google OAuth Worker Integration', () => {
  let env: any;

  beforeEach(() => {
    // Mock environment variables
    env = {
      CLIENT_ID: 'test-client-id',
      CLIENT_SECRET: 'test-client-secret',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      // Mock KV namespace for storing state
      OAUTH_STATE: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      } as any,
    };
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS preflight at worker level', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not include CORS headers for non-whitelisted origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil.com',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should include CORS headers in error responses', async () => {
      const request = new Request('https://example.com/nonexistent', {
        headers: {
          'Origin': 'https://promptedblog.com',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
    });
  });

  describe('/oauth/google/start endpoint', () => {
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
      await worker.fetch(request, env);

      expect(env.OAUTH_STATE.put).toHaveBeenCalled();
      const [[stateKey, stateData]] = env.OAUTH_STATE.put.mock.calls;
      expect(stateKey).toMatch(/^state:/);

      const parsedData = JSON.parse(stateData);
      expect(parsedData.codeVerifier).toBeTruthy();
      expect(parsedData.timestamp).toBeTruthy();
    });
  });

  describe('/oauth/google/callback endpoint', () => {
    it('should exchange code for token and get user info', async () => {
      const state = 'test-state-123';
      const codeVerifier = 'test-verifier-456';

      // Mock stored state
      env.OAUTH_STATE.get.mockResolvedValue(JSON.stringify({
        codeVerifier,
        timestamp: Date.now(),
      }));

      // Mock token exchange
      global.fetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          id_token: 'test-id-token',
        })))
        .mockResolvedValueOnce(new Response(JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'https://example.com/photo.jpg',
        })));

      const request = new Request(`https://example.com/oauth/google/callback?code=test-code&state=${state}`);
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(302);
      const location = response.headers.get('Location');
      expect(location).toContain('/oauth/callback');
      expect(location).toContain('user=');

      // Verify state was deleted after successful auth
      expect(env.OAUTH_STATE.delete).toHaveBeenCalledWith(`state:${state}`);
    });

    it('should handle missing authorization code', async () => {
      const request = new Request('https://example.com/oauth/google/callback');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('missing_code');
    });

    it('should handle invalid state', async () => {
      env.OAUTH_STATE.get.mockResolvedValue(null);

      const request = new Request('https://example.com/oauth/google/callback?code=test-code&state=invalid-state');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_state');
    });

    it('should handle OAuth error responses', async () => {
      const request = new Request('https://example.com/oauth/google/callback?error=access_denied&error_description=User+denied+access');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('access_denied');
      expect(data.error_description).toBe('User denied access');
    });

    it('should handle token exchange failure', async () => {
      const state = 'test-state-123';
      env.OAUTH_STATE.get.mockResolvedValue(JSON.stringify({
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      }));

      global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code',
      }), { status: 400 }));

      const request = new Request(`https://example.com/oauth/google/callback?code=invalid-code&state=${state}`);
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(500);
      const data = await response.json() as any;
      expect(data.error).toBe('internal_error');
    });
  });

  describe('Performance', () => {
    it('should handle request in under 50ms', async () => {
      const request = new Request('https://example.com/oauth/google/start');
      const start = performance.now();
      await worker.fetch(request, env);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Invalid routes', () => {
    it('should return 404 for unknown routes', async () => {
      const request = new Request('https://example.com/unknown');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      const data = await response.json() as any;
      expect(data.error).toBe('not_found');
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests from allowed origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com'
        }
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not set CORS headers for non-whitelisted origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com'
        }
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('should not set CORS headers when no origin is provided', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
    });
  });
});
