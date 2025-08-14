// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../index';

describe('OAuth Callback POST endpoint', () => {
  let env: any;

  beforeEach(() => {
    env = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'http://localhost:3000/oauth/callback',
      FRONTEND_URL: 'http://localhost:3000',
      SESSION_ENCRYPTION_KEY: 'test-key-1234567890123456789012',
      ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
      OAUTH_SESSIONS: {
        put: async () => {},
        get: async () => null,
        delete: async () => {}
      },
      OAUTH_KV: {
        put: async () => {},
        get: async () => null,
        delete: async () => {}
      }
    };
  });

  describe('POST /oauth/callback', () => {
    it('should accept POST request with JSON body', async () => {
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'test-code',
          state: 'test-state',
          code_verifier: 'test-verifier',
          provider: 'google'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      
      // Should get 400 because no stored PKCE challenge exists
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
    });

    it('should reject POST request without code', async () => {
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          state: 'test-state',
          code_verifier: 'test-verifier'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject POST request without state', async () => {
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'test-code',
          code_verifier: 'test-verifier'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject POST request without code_verifier', async () => {
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'test-code',
          state: 'test-state'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject POST request with invalid JSON', async () => {
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json {'
      });
      
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should handle POST request with stored PKCE challenge', async () => {
      let deletedKey: string | undefined;
      
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: 'test-challenge',
            state: 'test-state',
            provider: 'google',
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };
      
      env.OAUTH_SESSIONS.delete = async (key: string) => {
        deletedKey = key;
      };

      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'test-code',
          state: 'test-state',
          code_verifier: 'test-verifier',
          provider: 'google'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      
      // Will fail at PKCE verification but should process the request
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      
      // The PKCE challenge should NOT be deleted on verification failure
      expect(deletedKey).toBeUndefined();
    });

    it('should handle latency requirement for POST', async () => {
      const start = Date.now();
      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code: 'test-code',
          state: 'test-state',
          code_verifier: 'test-verifier'
        })
      });
      
      const response = await worker.fetch(request, env, {});
      const duration = Date.now() - start;
      
      expect(response.status).toBe(400); // Expected since no PKCE challenge stored
      expect(duration).toBeLessThan(50); // < 50ms requirement
    });

    it('should still support GET request for backwards compatibility', async () => {
      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      // Should get 400 because no stored PKCE challenge exists
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
    });
  });
});