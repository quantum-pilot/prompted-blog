import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthHandler } from '../index';
import { ProfileClient } from '../../../api/profile-client';
import { getSessionId } from '../../../api/oauth-session';

vi.mock('../../../api/profile-client');
vi.mock('../../../api/oauth-session');

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
      value: { hostname: 'localhost', assign: mockAssign },
      writable: true
    });
  });

  afterEach(() => authHandler?.parentNode?.removeChild(authHandler));

  const setupMocks = (sessionId: string | null, hasUsername = false) => {
    vi.mocked(getSessionId).mockReturnValue(sessionId);
    const mockGetProfile = vi.fn().mockResolvedValue({
      success: true,
      user: {
        id: 'u1', email: 'test@example.com', provider: 'google',
        ...(hasUsername && { username: 'testuser' }),
        createdAt: '2024-01-01', updatedAt: '2024-01-01'
      }
    });
    vi.mocked(ProfileClient).mockImplementation(() => ({ getProfile: mockGetProfile } as any));
    return mockGetProfile;
  };

  it('should check authentication on init', async () => {
    const mockGetProfile = setupMocks('session-id');
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    expect(getSessionId).toHaveBeenCalled();
    expect(mockGetProfile).toHaveBeenCalled();
  });

  it('should route to admin if authenticated with username', async () => {
    setupMocks('session-id', true);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    await new Promise(r => setTimeout(r, 0));
    expect(mockAssign).toHaveBeenCalledWith('/admin');
  });

  it('should not route without username', async () => {
    setupMocks('session-id', false);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    await new Promise(r => setTimeout(r, 0));
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('should not route if not authenticated', async () => {
    setupMocks(null);
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    await new Promise(r => setTimeout(r, 0));
    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('should route on username-ready event', () => {
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    window.dispatchEvent(new CustomEvent('username-ready', {
      detail: { username: 'newuser' },
      bubbles: true
    }));
    expect(mockAssign).toHaveBeenCalledWith('/admin');
  });

  it('should route to subdomain in production', () => {
    window.location.hostname = 'promptedblog.com';
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    window.dispatchEvent(new CustomEvent('username-ready', {
      detail: { username: 'newuser' },
      bubbles: true
    }));
    expect(mockAssign).toHaveBeenCalledWith('https://newuser.promptedblog.com/admin/');
  });

  it('should cleanup on disconnect', () => {
    authHandler = new AuthHandler();
    document.body.appendChild(authHandler);
    const cleanupSpy = vi.spyOn(authHandler['eventManager'], 'cleanup');
    authHandler.disconnectedCallback();
    expect(cleanupSpy).toHaveBeenCalled();
  });
});