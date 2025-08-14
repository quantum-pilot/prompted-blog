import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create mock functions
const mockStartAuthFlow = vi.fn();
const mockHandleCallback = vi.fn();
const mockValidateSession = vi.fn();
const mockLogout = vi.fn();

// Mock the API client module with factory function
vi.mock('../api/oauth-client', () => {
  return {
    OAuthProvider: {
      Google: 'google',
      GitHub: 'github'
    },
    OAuthClient: vi.fn(() => ({
      startAuthFlow: mockStartAuthFlow,
      handleCallback: mockHandleCallback,
      validateSession: mockValidateSession,
      logout: mockLogout
    }))
  };
});

describe('OAuth Handler', () => {
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();

    // Reset all mock functions
    mockStartAuthFlow.mockReset();
    mockHandleCallback.mockReset();
    mockValidateSession.mockReset();
    mockLogout.mockReset();

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Reset modules to ensure fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setupOAuthHandler', () => {
    it('should register oauth-start event listener', async () => {
      // Dynamically import to get fresh module with mocks
      const module = await import('../oauth-handler');

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      module.setupOAuthHandler();

      expect(addEventListenerSpy).toHaveBeenCalledWith('oauth-start', expect.any(Function));
    });

    it('should start OAuth flow when oauth-start event is dispatched', async () => {
      // Set production environment
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: 'app.example.com', origin: 'https://app.example.com' },
        writable: true,
        configurable: true
      });

      // Note: In the updated code, we need to mock the GOOGLE_CLIENT_ID constant
      // For now, the test will use the real value from oauth-handler.ts

      // Dynamically import to get fresh module with mocks
      const module = await import('../oauth-handler');
      module.setupOAuthHandler();

      const event = new CustomEvent('oauth-start', {
        detail: { provider: 'google' }
      });

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStartAuthFlow).toHaveBeenCalled();
    });

    it('should use mock flow in development without client ID', async () => {
      // Set development environment
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: 'localhost', origin: 'http://localhost' },
        writable: true,
        configurable: true
      });

      // Note: Mock OAuth will trigger on localhost when GOOGLE_CLIENT_ID is empty
      // which is the default in oauth-handler.ts

      // Dynamically import to get fresh module with mocks
      const module = await import('../oauth-handler');
      module.setupOAuthHandler();

      const event = new CustomEvent('oauth-start', {
        detail: { provider: 'google' }
      });

      const successListener = vi.fn();
      document.addEventListener('oauth-success', successListener);

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockStartAuthFlow).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('oauth_session_id')).toBe('mock-session-123');
      expect(console.log).toHaveBeenCalledWith('Development mode: Mocking OAuth flow');
      expect(successListener).toHaveBeenCalled();
    });

    it('should dispatch oauth-error event on failure', async () => {
      // Set production environment
      Object.defineProperty(window, 'location', {
        value: { ...window.location, hostname: 'app.example.com', origin: 'https://app.example.com' },
        writable: true,
        configurable: true
      });

      // Note: Tests assume production environment based on hostname

      // Mock failure
      mockStartAuthFlow.mockRejectedValueOnce(new Error('Network error'));

      // Dynamically import to get fresh module with mocks
      const module = await import('../oauth-handler');
      module.setupOAuthHandler();

      const errorListener = vi.fn();
      document.addEventListener('oauth-error', errorListener);

      const event = new CustomEvent('oauth-start', {
        detail: { provider: 'google' }
      });

      document.dispatchEvent(event);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { error: 'Network error' }
        })
      );
      expect(console.error).toHaveBeenCalledWith('Failed to start OAuth flow:', expect.any(Error));
    });

    it('should check existing session on setup', async () => {
      // Set up location
      Object.defineProperty(window, 'location', {
        value: { ...window.location, origin: 'https://app.example.com' },
        writable: true,
        configurable: true
      });

      mockValidateSession.mockResolvedValueOnce({
        userId: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        expiresAt: Date.now() + 3600000
      });

      const restoredListener = vi.fn();
      document.addEventListener('oauth-restored', restoredListener);

      // Dynamically import to get fresh module with mocks
      const module = await import('../oauth-handler');
      module.setupOAuthHandler();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockValidateSession).toHaveBeenCalled();
      expect(restoredListener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            user: expect.objectContaining({
              userId: 'user-123',
              email: 'user@example.com'
            })
          }
        })
      );
    });
  });
});
