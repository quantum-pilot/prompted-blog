// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../auth.middleware';
import { SessionManager } from '../../oauth-client/session-manager';
import { RequestContext } from '../../utils/request-context';
import * as cookieManager from '../../utils/cookie-manager';

vi.mock('../../utils/cookie-manager');
vi.mock('../../utils/request-context');
vi.mock('../../oauth-client/session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    getSession: vi.fn()
  }))
}));

describe('Auth Middleware Integration', () => {
  let app: Hono;
  let mockSessionManager: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSessionManager = {
      getSession: vi.fn()
    };
    
    (SessionManager as any).mockImplementation(() => mockSessionManager);
    
    vi.mocked(RequestContext.create).mockResolvedValue({
      log: vi.fn()
    } as any);
    
    app = new Hono();
    app.use('/api/*', authMiddleware());
    app.get('/api/profile', (c) => c.json({ 
      userId: c.get('userId'),
      email: c.get('userEmail')
    }));
  });
  
  it('should protect routes and provide user context', async () => {
    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue('valid-session');
    mockSessionManager.getSession.mockResolvedValue({
      sessionId: 'valid-session',
      userId: 'user-123',
      email: 'test@example.com'
    });
    
    const res = await app.request('/api/profile', {
      headers: { Cookie: 'session=valid-session' }
    });
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      userId: 'user-123',
      email: 'test@example.com'
    });
  });
  
  it('should reject requests without valid session', async () => {
    vi.mocked(cookieManager.getSessionFromCookie).mockReturnValue(null);
    
    const res = await app.request('/api/profile');
    
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: 'Unauthorized',
      message: 'No valid session found'
    });
  });
});