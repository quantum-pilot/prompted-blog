import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as oauth from 'oauth4webapi';
import { OAuthClient } from '../api/oauth-client';
import { OAuthProvider } from '../api/oauth-types';

// Mock the oauth4webapi library
vi.mock('oauth4webapi', () => ({
  generateRandomCodeVerifier: vi.fn(),
  calculatePKCECodeChallenge: vi.fn()
}));

// Create mock functions for popup handler
const mockOpenPopup = vi.fn();
const mockWaitForCallback = vi.fn();
const mockCleanup = vi.fn();
const mockIsPopupBlocked = vi.fn().mockReturnValue(false);
const mockGetPopup = vi.fn();

// Mock the popup handler
vi.mock('../api/oauth-popup-handler', () => ({
  OAuthPopupHandler: vi.fn().mockImplementation(() => ({
    openPopup: mockOpenPopup,
    waitForCallback: mockWaitForCallback,
    cleanup: mockCleanup,
    isPopupBlocked: mockIsPopupBlocked,
    getPopup: mockGetPopup
  }))
}));

// Mock providers - must be a function that returns the config
vi.mock('../api/oauth-providers', () => ({
  getProviderConfig: vi.fn(() => ({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['openid', 'email', 'profile'],
    additionalParams: { access_type: 'offline' }
  }))
}));

describe('OAuthClient - Popup Mode', () => {
  let client: OAuthClient;
  const mockConfig = {
    workerUrl: 'https://worker.example.com',
    clientId: 'test-client-id',
    redirectUri: 'https://app.example.com/oauth-callback.html',
    provider: OAuthProvider.Google
  };

  beforeEach(() => {
    // Reset all mock functions
    mockOpenPopup.mockClear();
    mockWaitForCallback.mockClear();
    mockCleanup.mockClear();
    mockIsPopupBlocked.mockClear();
    mockGetPopup.mockClear();
    
    // Reset popup blocked state
    mockIsPopupBlocked.mockReturnValue(false);
    
    client = new OAuthClient(mockConfig);
    
    // Mock crypto.getRandomValues
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array && 'length' in array) {
        const view = array as any;
        for (let i = 0; i < view.length; i++) {
          view[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    });
    
    // Setup oauth mocks
    (oauth.generateRandomCodeVerifier as any).mockReturnValue('test-verifier-123');
    (oauth.calculatePKCECodeChallenge as any).mockResolvedValue('test-challenge-456');
    
    // Clear storage
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('startAuthFlow with popup', () => {
    it('should store PKCE parameters in memory, not sessionStorage', async () => {
      // Mock successful popup flow with dynamic state matching
      mockWaitForCallback.mockImplementation(async () => {
        // Get the state that was generated (we can access it from the URL passed to openPopup)
        const urlArg = mockOpenPopup.mock.calls[0]?.[0];
        if (urlArg) {
          const url = new URL(urlArg);
          const state = url.searchParams.get('state');
          return {
            code: 'auth-code-123',
            state: state
          };
        }
        return { code: 'auth-code-123', state: 'test-state' };
      });
      
      // Mock fetch for code exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123',
          expiresAt: Date.now() + 3600000
        })
      });
      
      await client.startAuthFlow();
      
      // Verify nothing stored in sessionStorage for PKCE
      expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
      expect(sessionStorage.getItem('oauth_challenge')).toBeNull();
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
      expect(sessionStorage.getItem('oauth_provider')).toBeNull();
    });

    it('should open popup with correct authorization URL', async () => {
      // Mock successful popup flow
      mockWaitForCallback.mockImplementation(async () => {
        const urlArg = mockOpenPopup.mock.calls[0]?.[0];
        if (urlArg) {
          const url = new URL(urlArg);
          const state = url.searchParams.get('state');
          return { code: 'auth-code-123', state: state };
        }
        return { code: 'auth-code-123', state: 'test-state' };
      });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, sessionId: 'session-123' })
      });
      
      await client.startAuthFlow();
      
      expect(mockOpenPopup).toHaveBeenCalledWith(
        expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth')
      );
      
      const callArg = mockOpenPopup.mock.calls[0][0];
      const url = new URL(callArg);
      
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/oauth-callback.html');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('code_challenge')).toBe('test-challenge-456');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('access_type')).toBe('offline');
    });

    it('should wait for popup callback and exchange code', async () => {
      // Mock popup response with matching state
      mockWaitForCallback.mockImplementation(async () => {
        const urlArg = mockOpenPopup.mock.calls[0]?.[0];
        if (urlArg) {
          const url = new URL(urlArg);
          const state = url.searchParams.get('state');
          return { code: 'auth-code-789', state: state };
        }
        return { code: 'auth-code-789', state: 'test-state' };
      });
      
      // Mock worker response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123',
          expiresAt: Date.now() + 3600000
        })
      });
      
      await client.startAuthFlow();
      
      expect(mockWaitForCallback).toHaveBeenCalledWith(
        'https://app.example.com'
      );
      
      // Verify code exchange call to worker
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/oauth/callback'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Accept': 'application/json'
          })
        })
      );
      
      // Verify cleanup was called
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should validate state parameter for CSRF protection', async () => {
      // Mock popup response with mismatched state
      mockWaitForCallback.mockResolvedValue({
        code: 'auth-code-789',
        state: 'wrong-state'
      });
      
      await expect(client.startAuthFlow()).rejects.toThrow('State mismatch');
      
      // Ensure cleanup happens even on error
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should fall back to redirect mode if popup is blocked', async () => {
      // Mock popup being blocked
      mockOpenPopup.mockImplementation(() => {
        throw new Error('Popup blocked');
      });
      mockIsPopupBlocked.mockReturnValue(true);
      
      // Mock window.location
      delete (window as any).location;
      window.location = { href: '' } as any;
      
      await client.startAuthFlow();
      
      // Should fall back to redirect
      expect(window.location.href).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      
      // In fallback mode, PKCE should be stored in sessionStorage
      expect(sessionStorage.getItem('oauth_code_verifier')).toBe('test-verifier-123');
      expect(sessionStorage.getItem('oauth_challenge')).toBe('test-challenge-456');
      expect(sessionStorage.getItem('oauth_state')).toBeTruthy();
    });

    it('should handle popup errors gracefully', async () => {
      // Mock popup error
      mockWaitForCallback.mockRejectedValue(
        new Error('Popup closed without completing authentication')
      );
      
      await expect(client.startAuthFlow()).rejects.toThrow(
        'Popup closed without completing authentication'
      );
      
      // Cleanup should still be called
      expect(mockCleanup).toHaveBeenCalled();
    });

    it('should clear memory after successful authentication', async () => {
      // Mock successful flow with matching state
      mockWaitForCallback.mockImplementation(async () => {
        const urlArg = mockOpenPopup.mock.calls[0]?.[0];
        if (urlArg) {
          const url = new URL(urlArg);
          const state = url.searchParams.get('state');
          return { code: 'auth-code-789', state: state };
        }
        return { code: 'auth-code-789', state: 'test-state' };
      });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123',
          expiresAt: Date.now() + 3600000
        })
      });
      
      await client.startAuthFlow();
      
      // Verify session ID is stored
      expect(sessionStorage.getItem('oauth_session_id')).toBe('session-123');
      
      // Verify PKCE parameters are NOT in storage
      expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
      expect(sessionStorage.getItem('oauth_state')).toBeNull();
    });
  });

  describe('handleCallback for popup mode', () => {
    it('should handle callback URL from popup', async () => {
      const callbackUrl = new URL('https://app.example.com/oauth-callback.html?code=auth-123&state=state-456');
      
      // Mock fetch for code exchange
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          sessionId: 'session-123',
          expiresAt: Date.now() + 3600000
        })
      });
      
      // This method will be called by the popup handler internally
      // For popup mode, it should not need sessionStorage
      const result = await client.handleCallback(callbackUrl, 'test-verifier-123', 'state-456');
      
      expect(result).toEqual({ success: true });
    });
  });

  describe('security considerations', () => {
    it('should not expose PKCE verifier in any logs or errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockWaitForCallback.mockRejectedValue(
        new Error('Network error')
      );
      
      try {
        await client.startAuthFlow();
      } catch (error) {
        // Check error message doesn't contain verifier
        expect((error as Error).message).not.toContain('test-verifier-123');
      }
      
      // Check console logs don't contain verifier
      const consoleCallsStr = JSON.stringify(consoleSpy.mock.calls);
      expect(consoleCallsStr).not.toContain('test-verifier-123');
      
      consoleSpy.mockRestore();
    });

    it('should validate message origin strictly', async () => {
      // Mock successful flow
      mockWaitForCallback.mockImplementation(async () => {
        const urlArg = mockOpenPopup.mock.calls[0]?.[0];
        if (urlArg) {
          const url = new URL(urlArg);
          const state = url.searchParams.get('state');
          return { code: 'auth-code-789', state: state };
        }
        return { code: 'auth-code-789', state: 'test-state' };
      });
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, sessionId: 'session-123' })
      });
      
      await client.startAuthFlow();
      
      // Verify that waitForCallback is called with the correct origin
      expect(mockWaitForCallback).toHaveBeenCalledWith(
        'https://app.example.com'
      );
    });
  });
});