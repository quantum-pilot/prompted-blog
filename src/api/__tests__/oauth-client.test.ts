import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthClient, OAuthError, OAuthErrorType } from '../oauth-client';
import { OAuthProvider, OAuthConfig } from '@app/shared';

// Mock the hono-client module
const mockHonoClient = {
  oauth: {
    authorize: {
      $get: vi.fn()
    },
    callback: {
      $post: vi.fn()
    },
    session: {
      $get: vi.fn()
    },
    logout: {
      $post: vi.fn()
    }
  },
  api: {
    profile: {
      $get: vi.fn()
    },
    username: {
      check: {}
    }
  }
};

vi.mock('../hono-client', () => ({
  createHonoClient: vi.fn(() => mockHonoClient)
}));

// Mock window.location for redirect flow
const mockLocation = {
  href: '',
  origin: 'http://localhost:3000'
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
  configurable: true
});

// Mock sessionStorage
const mockSessionStorage = {
  storage: new Map<string, string>(),
  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  },
  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  },
  removeItem(key: string): void {
    this.storage.delete(key);
  },
  clear(): void {
    this.storage.clear();
  }
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
  writable: true
});

describe('OAuthClient - Redirect Flow', () => {
  let client: OAuthClient;
  const mockConfig: OAuthConfig = {
    clientId: 'test-client-id',
    redirectUri: 'http://localhost:3000/oauth/callback',
    provider: OAuthProvider.Google,
    workerUrl: 'http://localhost:8787'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();
    mockLocation.href = '';
    client = new OAuthClient(mockConfig);
  });

  describe('startAuthFlow', () => {
    it('should initiate OAuth flow with direct redirect', async () => {
      const mockAuthUrl = 'https://accounts.google.com/oauth/authorize?client_id=test&redirect_uri=callback&state=abc123';
      
      const mockResponse = new Response(JSON.stringify({
        success: true,
        authorizationUrl: mockAuthUrl
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
      mockHonoClient.oauth.authorize.$get.mockResolvedValue(mockResponse);

      await client.startAuthFlow();

      // Should call authorize endpoint
      expect(mockHonoClient.oauth.authorize.$get).toHaveBeenCalledWith({
        query: expect.objectContaining({
          provider: 'google'
        })
      });

      // Should store PKCE verifier and state in sessionStorage
      expect(mockSessionStorage.getItem('oauth_code_verifier')).toBeTruthy();
      expect(mockSessionStorage.getItem('oauth_state')).toBeTruthy();

      // Should redirect to authorization URL
      expect(mockLocation.href).toBe(mockAuthUrl);
    });

    it('should handle authorize endpoint errors', async () => {
      const mockResponse = new Response(JSON.stringify({
        error: 'invalid_request',
        error_description: 'Missing required parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
      
      mockHonoClient.oauth.authorize.$get.mockResolvedValue(mockResponse);

      await expect(client.startAuthFlow()).rejects.toThrow(OAuthError);
    });

    it('should handle network errors', async () => {
      mockHonoClient.oauth.authorize.$get.mockRejectedValue(new Error('Network error'));

      await expect(client.startAuthFlow()).rejects.toThrow(OAuthError);
    });
  });

  describe('validateSession', () => {
    it('should validate existing session', async () => {
      const mockSession = {
        userId: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        provider: 'google',
        expiresAt: Date.now() + 3600000
      };

      const mockResponse = new Response(JSON.stringify(mockSession), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      mockHonoClient.oauth.session.$get.mockResolvedValue(mockResponse);

      const result = await client.validateSession();

      expect(result).toEqual({
        success: true,
        ...mockSession
      });
    });

    it('should return null for invalid session', async () => {
      const mockResponse = new Response(JSON.stringify({
        error: 'session_not_found',
        error_description: 'Session expired or invalid'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

      mockHonoClient.oauth.session.$get.mockResolvedValue(mockResponse);

      const result = await client.validateSession();

      expect(result).toBeNull();
    });

    it('should handle session validation errors gracefully', async () => {
      mockHonoClient.oauth.session.$get.mockRejectedValue(new Error('Network error'));

      const result = await client.validateSession();

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and clear session storage', async () => {
      // Setup session storage with OAuth data
      mockSessionStorage.setItem('oauth_code_verifier', 'test-verifier');
      mockSessionStorage.setItem('oauth_state', 'test-state');

      const mockResponse = new Response(JSON.stringify({
        success: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

      mockHonoClient.oauth.logout.$post.mockResolvedValue(mockResponse);

      await client.logout();

      // Should call logout endpoint
      expect(mockHonoClient.oauth.logout.$post).toHaveBeenCalled();

      // Should clear session storage
      expect(mockSessionStorage.getItem('oauth_code_verifier')).toBeNull();
      expect(mockSessionStorage.getItem('oauth_state')).toBeNull();
    });

    it('should handle logout errors gracefully', async () => {
      mockHonoClient.oauth.logout.$post.mockRejectedValue(new Error('Network error'));

      // Should not throw, just log error
      await expect(client.logout()).resolves.toBeUndefined();

      // Should still clear session storage
      expect(mockSessionStorage.getItem('oauth_code_verifier')).toBeNull();
      expect(mockSessionStorage.getItem('oauth_state')).toBeNull();
    });
  });

  describe('PKCE flow', () => {
    it('should generate valid PKCE verifier', () => {
      const verifier = (client as any).generateCodeVerifier();
      
      // Should be base64url encoded
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      // Should be at least 43 characters (minimum for PKCE)
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      // Should be at most 128 characters (maximum for PKCE)
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should generate valid PKCE challenge from verifier', async () => {
      const verifier = (client as any).generateCodeVerifier();
      const challenge = await (client as any).generateCodeChallenge(verifier);
      
      // Should be base64url encoded
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      // Should be exactly 43 characters (SHA-256 base64url)
      expect(challenge.length).toBe(43);
    });

    it('should generate unique state parameters', () => {
      const state1 = (client as any).generateState();
      const state2 = (client as any).generateState();
      
      expect(state1).not.toBe(state2);
      // Should be base64url encoded
      expect(state1).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(state2).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('Error handling', () => {
    it('should create appropriate OAuthError for network failures', async () => {
      mockHonoClient.oauth.authorize.$get.mockRejectedValue(new Error('Network error'));

      try {
        await client.startAuthFlow();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.NETWORK_ERROR);
      }
    });

    it('should create appropriate OAuthError for server errors', async () => {
      const mockResponse = new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      });
      
      mockHonoClient.oauth.authorize.$get.mockResolvedValue(mockResponse);

      try {
        await client.startAuthFlow();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.SERVER_ERROR);
      }
    });

    it('should create appropriate OAuthError for invalid responses', async () => {
      const mockResponse = new Response('Not JSON', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
      
      mockHonoClient.oauth.authorize.$get.mockResolvedValue(mockResponse);

      try {
        await client.startAuthFlow();
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthError);
        expect((error as OAuthError).type).toBe(OAuthErrorType.INVALID_RESPONSE);
      }
    });
  });

  describe('Environment detection', () => {
    it('should use production domain when appropriate', () => {
      // Mock production environment
      const productionClient = new OAuthClient({
        ...mockConfig,
        redirectUri: 'https://promptedblog.com/oauth/callback'
      });

      expect((productionClient as any).config.redirectUri).toBe('https://promptedblog.com/oauth/callback');
    });

    it('should use localhost for development', () => {
      expect(client['config'].redirectUri).toBe('http://localhost:3000/oauth/callback');
    });
  });
});