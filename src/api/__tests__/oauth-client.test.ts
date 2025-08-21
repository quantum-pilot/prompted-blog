import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthClient } from '../oauth-client';
import { OAuthProvider, OAuthConfig } from '@app/shared';

// Mock oauth4webapi
vi.mock('oauth4webapi', () => ({
  generateRandomCodeVerifier: vi.fn(() => 'test-verifier'),
  calculatePKCECodeChallenge: vi.fn(() => Promise.resolve('test-challenge'))
}));

// Mock the hono-client module
const mockHonoClient = {
  oauth: {
    callback: {
      $post: vi.fn()
    },
    session: {
      $get: vi.fn()
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

// Mock the popup handler for successful popup flow
const mockPopupHandler = {
  openPopup: vi.fn(),
  waitForCallback: vi.fn(),
  cleanup: vi.fn(),
  isPopupBlocked: vi.fn().mockReturnValue(false),
  getPopup: vi.fn()
};

vi.mock('../oauth-popup-handler', () => ({
  OAuthPopupHandler: vi.fn().mockImplementation(() => mockPopupHandler)
}));

describe('OAuthClient', () => {
  let client: OAuthClient;
  
  const mockConfig: OAuthConfig = {
    workerUrl: 'https://worker.example.com',
    clientId: 'test-client-id',
    redirectUri: 'https://app.example.com/oauth/callback',
    provider: OAuthProvider.Google
  };

  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
    
    // Reset mock implementations
    mockPopupHandler.openPopup.mockClear();
    mockPopupHandler.waitForCallback.mockClear();
    mockPopupHandler.cleanup.mockClear();
    mockPopupHandler.isPopupBlocked.mockClear();
    mockPopupHandler.isPopupBlocked.mockReturnValue(false);
    
    // Reset hono client mocks with default success responses
    mockHonoClient.oauth.callback.$post.mockClear();
    mockHonoClient.oauth.callback.$post.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });
    
    mockHonoClient.oauth.session.$get.mockClear();
    mockHonoClient.oauth.session.$get.mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: 'google',
        email: 'test@example.com',
        name: 'Test User',
        expiresAt: Date.now() + 3600000
      })
    });
    
    client = new OAuthClient(mockConfig);
  });

  afterEach(() => {
    // Explicitly reset all mocks to default state
    mockPopupHandler.openPopup.mockReset();
    mockPopupHandler.waitForCallback.mockReset();
    mockPopupHandler.cleanup.mockReset();
    mockPopupHandler.isPopupBlocked.mockReset();
    mockPopupHandler.isPopupBlocked.mockReturnValue(false);
    mockPopupHandler.getPopup.mockReset();
    vi.clearAllMocks();
  });

  describe('startAuthFlow', () => {
    it('should open popup with correct authorization URL', async () => {
      // Mock successful popup callback
      mockPopupHandler.waitForCallback.mockResolvedValue({
        code: 'auth-code',
        state: 'test-state'
      });
      
      // Mock successful token exchange
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
        })
      });
      
      // Mock state validation - we need to capture the actual state
      let capturedState: string | null = null;
      mockPopupHandler.openPopup.mockImplementation((url: string) => {
        const urlObj = new URL(url);
        capturedState = urlObj.searchParams.get('state');
      });
      
      mockPopupHandler.waitForCallback.mockImplementation(async () => ({
        code: 'auth-code',
        state: capturedState // Use the actual state from the URL
      }));
      
      await client.startAuthFlow();
      
      // Check popup was opened with correct URL
      expect(mockPopupHandler.openPopup).toHaveBeenCalledTimes(1);
      const authUrl = mockPopupHandler.openPopup.mock.calls[0][0];
      const url = new URL(authUrl);
      
      expect(url.origin).toBe('https://accounts.google.com');
      expect(url.pathname).toBe('/o/oauth2/v2/auth');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/oauth/callback');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('code_challenge')).toBe('test-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      
      // Check cleanup was called
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });


    it('should handle popup blocked error', async () => {
      mockPopupHandler.openPopup.mockImplementation(() => {
        throw new Error('Popup blocked');
      });
      mockPopupHandler.isPopupBlocked.mockReturnValue(true);
      
      await expect(client.startAuthFlow()).rejects.toThrow('Popup was blocked. Please allow popups for authentication.');
      
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
      
      // Reset isPopupBlocked for next tests
      mockPopupHandler.isPopupBlocked.mockReturnValue(false);
    });

    it('should validate state to prevent CSRF attacks', async () => {
      // Reset and explicitly set isPopupBlocked to false
      mockPopupHandler.isPopupBlocked.mockReset();
      mockPopupHandler.isPopupBlocked.mockReturnValue(false);
      
      mockPopupHandler.waitForCallback.mockResolvedValue({
        code: 'auth-code',
        state: 'wrong-state'
      });
      
      await expect(client.startAuthFlow()).rejects.toThrow('State mismatch - possible CSRF attack');
      
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });

    it('should handle OAuth errors from popup', async () => {
      // Reset and explicitly set isPopupBlocked to false
      mockPopupHandler.isPopupBlocked.mockReset();
      mockPopupHandler.isPopupBlocked.mockReturnValue(false);
      
      mockPopupHandler.waitForCallback.mockRejectedValue(
        new Error('OAuth error: access_denied - User denied access')
      );
      
      await expect(client.startAuthFlow()).rejects.toThrow('OAuth error: access_denied - User denied access');
      
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });

    it('should handle worker errors during token exchange', async () => {
      // Mock successful popup callback
      mockPopupHandler.waitForCallback.mockResolvedValue({
        code: 'auth-code',
        state: 'test-state'
      });
      
      // Mock state validation
      let capturedState: string | null = null;
      mockPopupHandler.openPopup.mockImplementation((url: string) => {
        const urlObj = new URL(url);
        capturedState = urlObj.searchParams.get('state');
      });
      
      mockPopupHandler.waitForCallback.mockImplementation(async () => ({
        code: 'auth-code',
        state: capturedState
      }));
      
      // Mock failed token exchange
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: false,
        status: 500
      });
      
      await expect(client.startAuthFlow()).rejects.toThrow('Worker error: 500');
      
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for session token when PKCE params provided', async () => {
      // Mock successful worker response
      const mockResponse = {
        success: true
      };
      
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const callbackUrl = new URL('https://app.example.com/oauth/callback?code=auth-code&state=test-state');
      const result = await client.handleCallback(callbackUrl, 'test-verifier', 'test-state');
      
      expect(result).toEqual({ success: true });
      
      // Check worker was called correctly
      expect(mockHonoClient.oauth.callback.$post).toHaveBeenCalled();
      const calls = mockHonoClient.oauth.callback.$post.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      
      const [args] = calls[0];
      expect(args.json).toEqual({
        code: 'auth-code',
        state: 'test-state',
        code_verifier: 'test-verifier',
        provider: 'google'
      });
    });

    it('should require PKCE parameters', async () => {
      const callbackUrl = new URL('https://app.example.com/oauth/callback?code=auth-code&state=test-state');
      
      await expect(client.handleCallback(callbackUrl)).rejects.toThrow(
        'Missing required PKCE parameters. Popup mode requires codeVerifier and state.'
      );
    });

    it('should handle state mismatch errors', async () => {
      const callbackUrl = new URL('https://app.example.com/oauth/callback?code=auth-code&state=wrong-state');
      
      await expect(client.handleCallback(callbackUrl, 'test-verifier', 'test-state'))
        .rejects.toThrow('State mismatch - possible CSRF attack');
    });

    it('should handle missing authorization code', async () => {
      const callbackUrl = new URL('https://app.example.com/oauth/callback?state=test-state');
      
      await expect(client.handleCallback(callbackUrl, 'test-verifier', 'test-state'))
        .rejects.toThrow('Missing authorization code');
    });
  });

  describe('validateSession', () => {
    it('should validate session with worker using cookies', async () => {
      const session = await client.validateSession();
      
      // The session returned should be OAuthSession type
      expect(session).toEqual({
        provider: 'google',
        email: 'test@example.com',
        name: 'Test User',
        picture: undefined,
        expiresAt: expect.any(Number)
      });
    });

    it('should handle expired sessions', async () => {
      // Mock expired session response
      mockHonoClient.oauth.session.$get.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'session_expired' })
      });
      
      const session = await client.validateSession();
      
      expect(session).toBeNull();
    });
  });

  describe('logout', () => {
    it('should call logout endpoint and handle success', async () => {
      // Mock successful logout response
      mockHonoClient.oauth.logout = {
        $post: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, message: 'Logged out successfully' })
        })
      };
      
      // Mock window.location for redirect testing
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/' } as Location;
      
      await client.logout();
      
      // Verify logout endpoint was called with credentials
      expect(mockHonoClient.oauth.logout.$post).toHaveBeenCalledWith({});
      
      // Verify redirect to home page
      expect(window.location.href).toBe('/');
      
      // Restore window.location
      window.location = originalLocation;
    });
    
    it('should still redirect even if logout API call fails', async () => {
      // Mock failed logout response
      mockHonoClient.oauth.logout = {
        $post: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      
      // Mock console.error to verify error logging
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock window.location for redirect testing
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/' } as Location;
      
      await client.logout();
      
      // Verify logout was attempted
      expect(mockHonoClient.oauth.logout.$post).toHaveBeenCalled();
      
      // Verify error was logged but not thrown
      expect(consoleSpy).toHaveBeenCalledWith('Logout error:', expect.any(Error));
      
      // Verify user is still redirected (logout should always succeed from user perspective)
      expect(window.location.href).toBe('/');
      
      // Restore
      consoleSpy.mockRestore();
      window.location = originalLocation;
    });
    
    it('should clear in-memory OAuth state on logout', async () => {
      // Mock successful logout
      mockHonoClient.oauth.logout = {
        $post: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        })
      };
      
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/' } as Location;
      
      // Start an auth flow to populate in-memory state (then interrupt it)
      mockPopupHandler.openPopup.mockImplementation(() => {
        // Simulate user closing popup immediately
        throw new Error('User closed popup');
      });
      
      try {
        await client.startAuthFlow();
      } catch {
        // Expected - popup was closed
      }
      
      // Now logout should clear any remaining state
      await client.logout();
      
      // Verify cleanup happens (state clearing is internal, but we can verify the API call)
      expect(mockHonoClient.oauth.logout.$post).toHaveBeenCalled();
      
      // Restore
      window.location = originalLocation;
    });
    
    it('should dispatch a custom logout event for other components to listen to', async () => {
      // Mock successful logout
      mockHonoClient.oauth.logout = {
        $post: vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        })
      };
      
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/' } as Location;
      
      // Set up event listener
      const logoutHandler = vi.fn();
      window.addEventListener('oauth:logout', logoutHandler);
      
      await client.logout();
      
      // Verify custom event was dispatched
      expect(logoutHandler).toHaveBeenCalled();
      
      // Clean up
      window.removeEventListener('oauth:logout', logoutHandler);
      window.location = originalLocation;
    });
    
    it('should handle logout response without throwing even with non-ok status', async () => {
      // Mock 500 error response
      mockHonoClient.oauth.logout = {
        $post: vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Internal server error' })
        })
      };
      
      // Mock console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock window.location
      const originalLocation = window.location;
      delete (window as any).location;
      window.location = { ...originalLocation, href: '/' } as Location;
      
      // Should not throw
      await expect(client.logout()).resolves.not.toThrow();
      
      // Verify error was logged
      expect(consoleSpy).toHaveBeenCalledWith('Logout API returned non-ok status:', 500);
      
      // Verify redirect still happens
      expect(window.location.href).toBe('/');
      
      // Restore
      consoleSpy.mockRestore();
      window.location = originalLocation;
    });
  });


  describe('security considerations', () => {
    it('should not expose PKCE verifier in any logs or errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Mock network error during popup flow
      mockPopupHandler.waitForCallback.mockRejectedValue(new Error('Network error'));
      
      try {
        await client.startAuthFlow();
      } catch (error) {
        // Check error message doesn't contain verifier
        expect((error as Error).message).not.toContain('test-verifier');
      }
      
      // Check console logs don't contain verifier
      const consoleCallsStr = JSON.stringify(consoleSpy.mock.calls);
      expect(consoleCallsStr).not.toContain('test-verifier');
      
      consoleSpy.mockRestore();
    });

    it('should validate message origin strictly', async () => {
      // Mock successful popup callback with matching state
      let capturedState: string | null = null;
      mockPopupHandler.openPopup.mockImplementation((url: string) => {
        const urlObj = new URL(url);
        capturedState = urlObj.searchParams.get('state');
      });
      
      mockPopupHandler.waitForCallback.mockImplementation(async () => ({
        code: 'auth-code',
        state: capturedState
      }));
      
      // Mock successful token exchange
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
        })
      });
      
      await client.startAuthFlow();
      
      // Verify that waitForCallback is called with the correct origin
      expect(mockPopupHandler.waitForCallback).toHaveBeenCalledWith('https://app.example.com');
    });

    it('should store PKCE parameters in memory only, not sessionStorage', async () => {
      // Mock successful popup flow with matching state
      let capturedState: string | null = null;
      mockPopupHandler.openPopup.mockImplementation((url: string) => {
        const urlObj = new URL(url);
        capturedState = urlObj.searchParams.get('state');
      });
      
      mockPopupHandler.waitForCallback.mockImplementation(async () => ({
        code: 'auth-code',
        state: capturedState
      }));
      
      // Mock successful token exchange
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
        })
      });
      
      // Clear sessionStorage before test
      sessionStorage.clear();
      
      await client.startAuthFlow();
      
      // Verify PKCE parameters are NOT in sessionStorage
      expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
      expect(sessionStorage.getItem('oauth_challenge')).toBeNull();
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
      expect(sessionStorage.getItem('oauth_provider')).toBeNull();
      
      // Verify session ID is also NOT in sessionStorage
      // Sessions are now handled via HttpOnly cookies
      expect(sessionStorage.getItem('oauth_session_id')).toBeNull();
    });

    it('should clear memory after successful authentication', async () => {
      // Mock successful popup flow with matching state
      let capturedState: string | null = null;
      mockPopupHandler.openPopup.mockImplementation((url: string) => {
        const urlObj = new URL(url);
        capturedState = urlObj.searchParams.get('state');
      });
      
      mockPopupHandler.waitForCallback.mockImplementation(async () => ({
        code: 'auth-code',
        state: capturedState
      }));
      
      // Mock successful token exchange
      mockHonoClient.oauth.callback.$post.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true
        })
      });
      
      await client.startAuthFlow();
      
      // Verify cleanup was called
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });
  });
});