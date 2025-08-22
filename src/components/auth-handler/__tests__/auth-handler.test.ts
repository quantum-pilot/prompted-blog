import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthHandler } from '../index';

// Mock auth-state module
vi.mock('../../../auth-state', () => {
  const mockSubscribe = vi.fn();
  const mockGetState = vi.fn();
  const mockCheckAuthStatus = vi.fn();
  
  return {
    authState: {
      subscribe: mockSubscribe,
      getState: mockGetState,
      checkAuthStatus: mockCheckAuthStatus,
      clearAuth: vi.fn(),
      refreshAuth: vi.fn()
    }
  };
});

import { authState } from '../../../auth-state';

describe('AuthHandler', () => {
  let authHandler: AuthHandler;
  let mockAssign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    if (!customElements.get('auth-handler')) {
      customElements.define('auth-handler', AuthHandler);
    }
    vi.clearAllMocks();
    mockAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { 
        hostname: 'localhost', 
        protocol: 'http:',
        port: '',
        assign: mockAssign 
      },
      writable: true
    });
  });

  afterEach(() => authHandler?.parentNode?.removeChild(authHandler));

  const setupMocks = (authenticated = true, hasUsername = false) => {
    const mockState = {
      isAuthenticated: authenticated,
      isChecking: false,
      session: authenticated ? { 
        email: 'test@example.com', 
        provider: 'google' as const,
        expiresAt: Date.now() + 3600000
      } : null,
      user: authenticated ? {
        id: 'u1',
        email: 'test@example.com',
        provider: 'google' as const,
        username: hasUsername ? 'testuser' : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now()
      } : null
    };

    vi.mocked(authState.getState).mockReturnValue(mockState);
    vi.mocked(authState.checkAuthStatus).mockResolvedValue(undefined);
    
    // Setup subscribe to call callback immediately and return unsubscribe
    vi.mocked(authState.subscribe).mockImplementation((callback) => {
      callback(mockState);
      return vi.fn(); // Return unsubscribe function
    });
    
    return mockState;
  };

  it('should check authentication on init', async () => {
    setupMocks(true);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    expect(authState.checkAuthStatus).toHaveBeenCalled();
  });

  it('should redirect to admin when user has username', async () => {
    setupMocks(true, true);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    // On localhost, it redirects to /admin (not /admin/username)
    await vi.waitFor(() => expect(mockAssign).toHaveBeenCalledWith('/admin'));
  });

  it('should not redirect when user has no username', async () => {
    setupMocks(true, false);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    await new Promise(r => setTimeout(r, 10));
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('should not redirect when not authenticated', async () => {
    setupMocks(false);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    await new Promise(r => setTimeout(r, 10));
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('should handle username-ready event', () => {
    setupMocks(true, false);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    window.dispatchEvent(new CustomEvent('username-ready', { detail: { username: 'newuser' } }));
    // On localhost, it redirects to /admin (not /admin/username)
    expect(mockAssign).toHaveBeenCalledWith('/admin');
  });

  it('should remove listeners on disconnect', () => {
    const unsubscribe = vi.fn();
    vi.mocked(authState.subscribe).mockReturnValue(unsubscribe);
    
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    authHandler.remove();
    
    expect(unsubscribe).toHaveBeenCalled();
  });
});