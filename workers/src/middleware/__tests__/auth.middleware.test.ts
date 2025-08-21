// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Context } from 'hono';
import { authMiddleware } from '../auth.middleware';
import { SessionManager } from '../../oauth-client/session-manager';
import { RequestContext } from '../../utils/request-context';
import * as cookieManager from '../../utils/cookie-manager';

vi.mock('../../utils/cookie-manager');
vi.mock('../../utils/request-context');

// Mock SessionManager
vi.mock('../../oauth-client/session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    getSession: vi.fn()
  }))
}));

describe('authMiddleware', () => {
  let mockContext: Context;
  let mockNext: () => Promise<void>;
  let mockSessionManager: any;
  let middleware: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn().mockResolvedValue(undefined);
    
    mockSessionManager = {
      getSession: vi.fn()
    };
    
    (SessionManager as any).mockImplementation(() => mockSessionManager);
    
    vi.mocked(RequestContext.create).mockResolvedValue({
      log: vi.fn()
    } as any);
    
    mockContext = {
      set: vi.fn(),
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
      req: {
        header: vi.fn(),
        raw: {} as Request
      },
      env: {}
    } as unknown as Context;
    
    middleware = authMiddleware();
  });

  it('should return 401 when no session cookie is present', async () => {
    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue(null);

    await middleware(mockContext, mockNext);

    expect(cookieManager.getSessionFromCookie).toHaveBeenCalledWith(mockContext.req.raw);
    expect(mockContext.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'No valid session found'
    }, 401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 when session is invalid or expired', async () => {
    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue('test-session-id');
    mockSessionManager.getSession.mockResolvedValue(null);

    await middleware(mockContext, mockNext);

    expect(mockSessionManager.getSession).toHaveBeenCalledWith('test-session-id', expect.any(Object));
    expect(mockContext.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Session is invalid or expired'
    }, 401);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should attach user data to context and call next for valid session', async () => {
    const mockSessionData = {
      sessionId: 'test-session-id',
      userId: 'user-123',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };

    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue('test-session-id');
    mockSessionManager.getSession.mockResolvedValue(mockSessionData);

    await middleware(mockContext, mockNext);

    expect(mockContext.set).toHaveBeenCalledWith('userId', 'user-123');
    expect(mockContext.set).toHaveBeenCalledWith('userEmail', 'test@example.com');
    expect(mockContext.set).toHaveBeenCalledWith('sessionId', 'test-session-id');
    expect(mockContext.set).toHaveBeenCalledWith('session', mockSessionData);
    expect(mockNext).toHaveBeenCalled();
    expect(mockContext.json).not.toHaveBeenCalled();
  });

  it('should complete in less than 50ms', async () => {
    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue('test-session-id');
    mockSessionManager.getSession.mockResolvedValue({
      sessionId: 'test-session-id',
      userId: 'user-123',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    });

    const start = performance.now();
    await middleware(mockContext, mockNext);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});