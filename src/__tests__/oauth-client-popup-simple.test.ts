import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as oauth from 'oauth4webapi';
import { OAuthClient } from '../api/oauth-client';
import { OAuthProvider } from '../api/oauth-types';
import { getSessionId } from '../api/oauth-session';

// Mock oauth4webapi
vi.mock('oauth4webapi', () => ({
  generateRandomCodeVerifier: vi.fn(() => 'test-verifier-123'),
  calculatePKCECodeChallenge: vi.fn(() => Promise.resolve('test-challenge-456'))
}));

// Create stable mock functions
const mockOpenPopup = vi.fn();
const mockWaitForCallback = vi.fn();
const mockCleanup = vi.fn();
const mockIsPopupBlocked = vi.fn();
const mockGetPopup = vi.fn();

// Mock the popup handler
vi.mock('../api/oauth-popup-handler', () => ({
  OAuthPopupHandler: vi.fn(() => ({
    openPopup: mockOpenPopup,
    waitForCallback: mockWaitForCallback,
    cleanup: mockCleanup,
    isPopupBlocked: mockIsPopupBlocked,
    getPopup: mockGetPopup
  }))
}));

// Mock providers
vi.mock('../api/oauth-providers', () => ({
  getProviderConfig: vi.fn(() => ({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['openid', 'email', 'profile'],
    additionalParams: { access_type: 'offline' }
  }))
}));

describe('OAuthClient - Popup Mode (Simplified)', () => {
  let client: OAuthClient;
  
  beforeEach(() => {
    const config = {
      workerUrl: 'https://worker.example.com',
      clientId: 'test-client-id',
      redirectUri: 'https://app.example.com/oauth-callback.html',
      provider: OAuthProvider.Google
    };
    
    client = new OAuthClient(config);
    
    // Clear mocks
    mockOpenPopup.mockClear();
    mockWaitForCallback.mockClear();
    mockCleanup.mockClear();
    mockIsPopupBlocked.mockClear();
    mockIsPopupBlocked.mockReturnValue(false);
    mockGetPopup.mockClear();
    
    // Mock crypto
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      if (array && 'length' in array) {
        const view = array as any;
        for (let i = 0; i < view.length; i++) {
          view[i] = 1;
        }
      }
      return array;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not store PKCE parameters in sessionStorage when popup succeeds', async () => {
    // Mock successful popup flow
    mockWaitForCallback.mockImplementation(async () => {
      // Get the state from the URL that was passed to openPopup
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
    
    // Mock fetch for token exchange
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        sessionId: 'session-123'
      })
    });
    
    await client.startAuthFlow();
    
    // Verify PKCE parameters are NOT in sessionStorage (removed feature)
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
    expect(sessionStorage.getItem('oauth_challenge')).toBeNull();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    
    // Verify session ID is stored in memory only
    expect(getSessionId()).toBe('session-123');
    // Session ID should NOT be in sessionStorage
    expect(sessionStorage.getItem('oauth_session_id')).toBeNull();
  });
  
  it('should throw error when popup is blocked (no redirect fallback)', async () => {
    // Mock popup being blocked
    mockOpenPopup.mockImplementation(() => {
      throw new Error('Popup blocked');
    });
    mockIsPopupBlocked.mockReturnValue(true);
    
    await expect(client.startAuthFlow()).rejects.toThrow('Popup was blocked. Please allow popups for authentication.');
    
    // Verify no sessionStorage is used
    expect(sessionStorage.getItem('oauth_code_verifier')).toBeNull();
    expect(sessionStorage.getItem('oauth_challenge')).toBeNull();
    expect(sessionStorage.getItem('oauth_state')).toBeNull();
    
    // Verify cleanup was called
    expect(mockCleanup).toHaveBeenCalled();
  });
});