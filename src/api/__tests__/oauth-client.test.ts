import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthClient } from '../oauth-client';
import { OAuthProvider, OAuthConfig } from '@app/shared';
import { getSessionId, clearOAuthData } from '../oauth-session';

// Mock oauth4webapi
vi.mock('oauth4webapi', () => ({
  generateRandomCodeVerifier: vi.fn(() => 'test-verifier'),
  calculatePKCECodeChallenge: vi.fn(() => Promise.resolve('test-challenge'))
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
    // Clear in-memory session
    clearOAuthData();
    
    // Mock fetch
    global.fetch = vi.fn();
    
    // Reset mock implementations
    mockPopupHandler.openPopup.mockClear();
    mockPopupHandler.waitForCallback.mockClear();
    mockPopupHandler.cleanup.mockClear();
    mockPopupHandler.isPopupBlocked.mockClear();
    mockPopupHandler.isPopupBlocked.mockReturnValue(false);
    
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123'
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
      
      // Check session ID was stored
      expect(getSessionId()).toBe('session-123');
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
      (global.fetch as any).mockResolvedValueOnce({
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
        success: true,
        sessionId: 'session-123',
        expiresAt: Date.now() + 3600000
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });
      
      const callbackUrl = new URL('https://app.example.com/oauth/callback?code=auth-code&state=test-state');
      const result = await client.handleCallback(callbackUrl, 'test-verifier', 'test-state');
      
      expect(result).toEqual({ success: true });
      
      // Check worker was called correctly with POST method
      expect(global.fetch).toHaveBeenCalledWith(
        'https://worker.example.com/oauth/callback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({
            code: 'auth-code',
            state: 'test-state',
            code_verifier: 'test-verifier',
            provider: 'google'
          })
        })
      );
      
      // Check session ID was stored
      expect(getSessionId()).toBe('session-123');
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
    it('should validate session with worker', async () => {
      // Store a session ID
      const { storeSessionId } = await import('../oauth-session');
      storeSessionId('session-123');
      
      const mockSession = {
        userId: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        expiresAt: Date.now() + 3600000
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSession
      });
      
      const session = await client.validateSession();
      
      expect(session).toEqual(mockSession);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://worker.example.com/oauth/session',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'Authorization': 'Bearer session-123'
          })
        })
      );
    });

    it('should return null if no session ID stored', async () => {
      const session = await client.validateSession();
      expect(session).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle expired sessions', async () => {
      // Store a session ID
      const { storeSessionId } = await import('../oauth-session');
      storeSessionId('session-123');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Session not found or expired'
      });
      
      const session = await client.validateSession();
      
      expect(session).toBeNull();
      expect(getSessionId()).toBeNull();
    });
  });

  describe('logout', () => {
    it('should clear session data', async () => {
      // Store a session ID
      const { storeSessionId } = await import('../oauth-session');
      storeSessionId('session-123');
      
      client.logout();
      
      expect(getSessionId()).toBeNull();
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123'
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123'
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
      
      // Verify session ID is also NOT in sessionStorage (memory only)
      expect(sessionStorage.getItem('oauth_session_id')).toBeNull();
      
      // But session ID should be in memory
      expect(getSessionId()).toBe('session-123');
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123',
          expiresAt: Date.now() + 3600000
        })
      });
      
      await client.startAuthFlow();
      
      // Verify session ID is stored in memory
      expect(getSessionId()).toBe('session-123');
      
      // Verify cleanup was called
      expect(mockPopupHandler.cleanup).toHaveBeenCalled();
    });
  });
});