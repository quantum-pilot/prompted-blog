import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env, StateData } from '../types';
import { exchangeCodeForToken, fetchUserInfo } from '../token-exchange';

describe('Token Exchange', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      CLIENT_ID: 'test-client-id',
      CLIENT_SECRET: 'test-client-secret',
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
