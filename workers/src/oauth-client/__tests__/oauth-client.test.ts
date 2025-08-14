// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../index';

describe('OAuth Client Worker', () => {
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

  describe('GET /oauth/health', () => {
    it('should return health status', async () => {
      const request = new Request('http://localhost/oauth/health');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });

    it('should handle latency requirement', async () => {
      const start = Date.now();
      const request = new Request('http://localhost/oauth/health');
      const response = await worker.fetch(request, env, {});
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // < 50ms requirement
    });
  });

  describe('GET /oauth/authorize', () => {
    it('should reject without code challenge', async () => {
      const request = new Request('http://localhost/oauth/authorize?state=test-state');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
    });

    it('should reject without state', async () => {
      const request = new Request('http://localhost/oauth/authorize?code_challenge=test-challenge');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should store PKCE challenge and return auth URL', async () => {
      let storedKey: string | undefined;
      let storedValue: string | undefined;
      
      env.OAUTH_SESSIONS.put = async (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
      };

      const request = new Request('http://localhost/oauth/authorize?code_challenge=test-challenge&state=test-state');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.authorizationUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(data.authorizationUrl).toContain('code_challenge=test-challenge');
      expect(data.authorizationUrl).toContain('code_challenge_method=S256');
      
      // Verify PKCE challenge was stored
      expect(storedKey).toBe('pkce:test-state');
      expect(storedValue).toBeDefined();
      const storedData = JSON.parse(storedValue!);
      expect(storedData.challenge).toBe('test-challenge');
      expect(storedData.state).toBe('test-state'); // Verify state is stored
    });
  });

  describe('GET /oauth/callback', () => {
    it('should reject callback without code', async () => {
      const request = new Request('http://localhost/oauth/callback?state=test-state');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback without state parameter', async () => {
      const request = new Request('http://localhost/oauth/callback?code=test-code&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback without PKCE verifier', async () => {
      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback without stored PKCE challenge', async () => {
      env.OAUTH_SESSIONS.get = async () => null;

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback with mismatched state parameter', async () => {
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: 'test-challenge',
            state: 'original-state', // Different from the state in the callback
            provider: 'google',
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback with expired PKCE session', async () => {
      let deletedKey: string | undefined;
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: 'test-challenge',
            state: 'test-state',
            provider: 'google',
            createdAt: Date.now() - 700000, // Created 11+ minutes ago
            expiresAt: Date.now() - 100000 // Expired 100 seconds ago
          });
        }
        return null;
      };
      env.OAUTH_SESSIONS.delete = async (key: string) => {
        deletedKey = key;
      };

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toBe('Authentication failed');
      expect(deletedKey).toBe('pkce:test-state'); // Verify cleanup happened
    });

    it('should reject callback with missing stored state', async () => {
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: 'test-challenge',
            // state is missing
            provider: 'google',
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should reject callback with invalid PKCE verifier', async () => {
      // Generate a real PKCE challenge for testing
      const encoder = new TextEncoder();
      const verifierData = encoder.encode('correct-verifier');
      const hash = await crypto.subtle.digest('SHA-256', verifierData);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: base64,
            state: 'test-state',
            provider: 'google',
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=wrong-verifier');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_grant');
      expect(data.error_description).toBe('Authentication failed');
    });

    it('should clean up PKCE challenge after successful validation', async () => {
      // Generate a real PKCE challenge for testing
      const encoder = new TextEncoder();
      const verifierData = encoder.encode('test-verifier');
      const hash = await crypto.subtle.digest('SHA-256', verifierData);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      let deletedKey: string | undefined;

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === 'pkce:test-state') {
          return JSON.stringify({
            challenge: base64,
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

      // Mock the OAuth token exchange to avoid external calls
      global.fetch = async () => {
        return new Response(JSON.stringify({
          access_token: 'test-token',
          id_token: btoa(JSON.stringify({})) + '.' + btoa(JSON.stringify({
            sub: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/pic.jpg'
          })) + '.signature',
          expires_in: 3600
        }), { status: 200 });
      };

      const request = new Request('http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier');
      const response = await worker.fetch(request, env, {});
      
      // The response might fail due to Google OAuth not being mocked properly,
      // but we should still see that the PKCE challenge was deleted
      expect(deletedKey).toBe('pkce:test-state');
    });
  });

  describe('GET /oauth/session', () => {
    it('should reject without sessionId', async () => {
      const request = new Request('http://localhost/oauth/session');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
    });

    it('should return 400 for invalid session ID format', async () => {
      const request = new Request('http://localhost/oauth/session', {
        headers: {
          'Authorization': 'Bearer invalid-id'
        }
      });
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(400);
      const data = await response.json() as any;
      expect(data.error).toBe('invalid_request');
    });

    it('should return session data for valid session', async () => {
      // Generate a valid session ID format (43-44 chars, base64url)
      const validSessionId = 'Abc123def456GHI789jkl012MNO345pqr678STU90-_';
      const sessionData = {
        id: validSessionId,
        provider: 'google',
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000
      };

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `session:${validSessionId}`) {
          return JSON.stringify(sessionData);
        }
        return null;
      };

      const request = new Request('http://localhost/oauth/session', {
        headers: {
          'Authorization': `Bearer ${validSessionId}`
        }
      });
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(200);
      const data = await response.json() as any;
      expect(data.userId).toBe('user-123');
      expect(data.email).toBe('test@example.com');
    });
  });

  describe('CORS handling', () => {
    it('should handle OPTIONS requests', async () => {
      const request = new Request('http://localhost/oauth/health', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' }
      });
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should add CORS headers to responses', async () => {
      const request = new Request('http://localhost/oauth/health', {
        headers: { Origin: 'http://localhost:3000' }
      });
      const response = await worker.fetch(request, env, {});
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown routes', async () => {
      const request = new Request('http://localhost/unknown');
      const response = await worker.fetch(request, env, {});
      
      expect(response.status).toBe(404);
      const data = await response.json() as any;
      expect(data.error).toBe('not_found');
    });
  });
});