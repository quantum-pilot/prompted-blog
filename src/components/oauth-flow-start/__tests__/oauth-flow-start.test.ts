import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthFlowStart } from '../index';
import { OAuthClient } from "../../../api/oauth-client";

// Mock dependencies
vi.mock("../../../api/oauth-client");
vi.mock('../../../auth-state', () => {
  const mockSubscribe = vi.fn();
  const mockGetState = vi.fn();
  const mockCheckAuthStatus = vi.fn();
  const mockClearAuth = vi.fn();
  const mockRefreshAuth = vi.fn();
  
  return {
    authState: {
      subscribe: mockSubscribe,
      getState: mockGetState,
      checkAuthStatus: mockCheckAuthStatus,
      clearAuth: mockClearAuth,
      refreshAuth: mockRefreshAuth
    }
  };
});

import { authState } from '../../../auth-state';

describe('OAuthFlowStart', () => {
  let component: OAuthFlowStart;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Register component if not already registered
    if (!customElements.get('oauth-flow-start')) {
      customElements.define('oauth-flow-start', OAuthFlowStart);
    }

    // Mock OAuthClient
    const mockStartAuthFlow = vi.fn().mockResolvedValue(undefined);
    const mockLogout = vi.fn().mockImplementation(async () => {
      // Simulate the real logout behavior - dispatch oauth:logout event
      window.dispatchEvent(new CustomEvent('oauth:logout'));
    });
    vi.mocked(OAuthClient).mockImplementation(() => ({
      startAuthFlow: mockStartAuthFlow,
      logout: mockLogout,
      validateSession: vi.fn(),
      handleCallback: vi.fn()
    } as any));
  });

  afterEach(() => {
    if (component && component.parentNode) {
      component.parentNode.removeChild(component);
    }
  });

  const setupAuthMocks = (authenticated = false) => {
    const mockState = {
      isAuthenticated: authenticated,
      isChecking: false,
      session: authenticated ? { 
        email: 'test@example.com', 
        provider: 'google' as const 
      } : null,
      user: authenticated ? {
        id: 'u1',
        email: 'test@example.com',
        provider: 'google' as const,
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

  it('should create and render sign-in button when not authenticated', () => {
    setupAuthMocks(false);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);

    const button = component.querySelector('.oauth-button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe('Sign in with Google');
    expect(button?.classList.contains('oauth-button--google')).toBe(true);
  });

  it('should create and render sign-out button when authenticated', () => {
    setupAuthMocks(true);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);

    const button = component.querySelector('.oauth-button');
    expect(button).toBeTruthy();
    expect(button?.textContent).toBe('Sign out');
    expect(button?.classList.contains('oauth-button--logout')).toBe(true);
  });

  it('should start OAuth flow when sign-in button is clicked', async () => {
    setupAuthMocks(false);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);

    const button = component.querySelector('.oauth-button') as HTMLButtonElement;
    const oauthStartListener = vi.fn();
    document.addEventListener('oauth-start', oauthStartListener);

    button.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(oauthStartListener).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { provider: 'google' }
      })
    );
  });

  it('should handle logout when sign-out button is clicked', async () => {
    setupAuthMocks(true);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);

    const button = component.querySelector('.oauth-button--logout') as HTMLButtonElement;
    
    button.click();
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const oauthClient = vi.mocked(OAuthClient).mock.results[0]?.value;
    expect(oauthClient?.logout).toHaveBeenCalled();
    expect(authState.clearAuth).toHaveBeenCalled();
  });

  it('should check auth status on init', () => {
    setupAuthMocks(false);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);
    
    expect(authState.checkAuthStatus).toHaveBeenCalled();
  });

  it('should re-render when auth state changes', () => {
    let stateCallback: ((state: any) => void) | null = null;
    
    vi.mocked(authState.subscribe).mockImplementation((callback) => {
      stateCallback = callback;
      // Call with initial state
      callback({
        isAuthenticated: false,
        isChecking: false,
        session: null,
        user: null
      });
      return vi.fn();
    });
    
    vi.mocked(authState.getState).mockReturnValue({
      isAuthenticated: false,
      isChecking: false,
      session: null,
      user: null
    });
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);
    
    // Initially shows sign-in button
    let button = component.querySelector('.oauth-button');
    expect(button?.textContent).toBe('Sign in with Google');
    
    // Simulate auth state change
    if (stateCallback) {
      stateCallback({
        isAuthenticated: true,
        isChecking: false,
        session: { email: 'test@example.com', provider: 'google' },
        user: { email: 'test@example.com', provider: 'google' }
      });
    }
    
    // Should now show sign-out button
    button = component.querySelector('.oauth-button');
    expect(button?.textContent).toBe('Sign out');
  });

  it('should unsubscribe from auth state on disconnect', () => {
    const unsubscribe = vi.fn();
    vi.mocked(authState.subscribe).mockReturnValue(unsubscribe);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);
    component.remove();
    
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should refresh auth state on successful OAuth', () => {
    setupAuthMocks(false);
    
    component = new OAuthFlowStart();
    document.body.appendChild(component);
    
    document.dispatchEvent(new CustomEvent('oauth-success'));
    
    expect(authState.refreshAuth).toHaveBeenCalled();
  });
});