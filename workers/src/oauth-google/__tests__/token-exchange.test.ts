import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env, StateData } from '../types';
import { exchangeCodeForToken, fetchUserInfo } from '../token-exchange';

describe('Token Exchange', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: {} as any,
    };

    vi.clearAllMocks();
  });

  describe('exchangeCodeForToken', () => {
    it('should exchange code for token successfully', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      };

      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const stateData: StateData = {
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      };

      const result = await exchangeCodeForToken(
        'test-code',
        stateData,
        env
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );

      // Verify the request body includes PKCE verifier but not client_secret
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = fetchCall[1].body;
      expect(requestBody).toContain('code_verifier=test-verifier');
      expect(requestBody).toContain('client_id=test-client-id');
      expect(requestBody).not.toContain('client_secret');
    });

    it('should throw error on failed exchange', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid code',
          }),
          { status: 400 }
        )
      );

      const stateData: StateData = {
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      };

      await expect(
        exchangeCodeForToken('invalid-code', stateData, env)
      ).rejects.toThrow('Invalid code');
    });

    it('should handle invalid code_verifier error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'invalid_grant',
            error_description: 'Invalid PKCE code_verifier',
          }),
          { status: 400 }
        )
      );

      const stateData: StateData = {
        codeVerifier: 'wrong-verifier',
        timestamp: Date.now(),
      };

      await expect(
        exchangeCodeForToken('valid-code', stateData, env)
      ).rejects.toThrow('Invalid PKCE code_verifier');
    });

    it('should include PKCE verifier in token request', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: 'test-id-token',
      };

      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const stateData: StateData = {
        codeVerifier: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~',
        timestamp: Date.now(),
      };

      await exchangeCodeForToken('test-code', stateData, env);

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = fetchCall[1].body;
      
      // Parse the URL-encoded body
      const params = new URLSearchParams(requestBody);
      
      // Verify PKCE parameters are included
      expect(params.get('code_verifier')).toBe('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~');
      expect(params.get('grant_type')).toBe('authorization_code');
      expect(params.get('code')).toBe('test-code');
      expect(params.get('client_id')).toBe('test-client-id');
      
      // Verify client_secret is NOT included
      expect(params.has('client_secret')).toBe(false);
    });

    it('should handle missing code_verifier in state data', async () => {
      const invalidStateData = {
        timestamp: Date.now(),
      } as any;

      await expect(
        exchangeCodeForToken('test-code', invalidStateData, env)
      ).rejects.toThrow();
    });

    it('should complete within 50ms (mocked)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'token' }))
      );

      const stateData: StateData = {
        codeVerifier: 'verifier',
        timestamp: Date.now(),
      };

      const start = performance.now();
      await exchangeCodeForToken('code', stateData, env);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });

    it('should handle response with refresh_token', async () => {
      const mockResponse = {
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'test-refresh-token',
        id_token: 'test-id-token',
      };

      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponse), { status: 200 })
      );

      const stateData: StateData = {
        codeVerifier: 'test-verifier',
        timestamp: Date.now(),
      };

      const result = await exchangeCodeForToken('test-code', stateData, env);

      expect(result).toEqual(mockResponse);
      expect(result.refresh_token).toBe('test-refresh-token');
    });
  });

  describe('fetchUserInfo', () => {
    it('should fetch user info successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
      };

      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify(mockUser), { status: 200 })
      );

      const result = await fetchUserInfo('test-token');

      expect(result).toEqual(mockUser);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v1/userinfo',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
          },
        })
      );
    });

    it('should throw error on failed fetch', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response('Unauthorized', { status: 401 })
      );

      await expect(fetchUserInfo('invalid-token')).rejects.toThrow(
        'Failed to fetch user information'
      );
    });

    it('should complete within 50ms (mocked)', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ id: '123' }))
      );

      const start = performance.now();
      await fetchUserInfo('token');
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});
