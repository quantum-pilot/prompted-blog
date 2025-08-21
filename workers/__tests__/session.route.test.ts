// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import app from '../src/routes/session.route';
import type { Env } from '../src/oauth-client/types';

// Mock the cookie manager
vi.mock('../src/utils/cookie-manager', () => ({
  getSessionFromCookie: vi.fn(),
  clearSessionCookie: vi.fn().mockReturnValue(new Headers({
    'Set-Cookie': 'pb_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
  })),
}));

// Mock the SessionManager
vi.mock('../src/oauth-client/session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    deleteSession: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock RequestContext
vi.mock('../src/utils/request-context', () => ({
  RequestContext: {
    create: vi.fn().mockResolvedValue({
      ip: '192.168.1.1',
      origin: 'http://localhost:3000',
      method: 'POST',
      log: vi.fn(),
      correlationId: 'test-correlation-id',
    }),
  },
}));

// Import mocked functions for test assertions
import { getSessionFromCookie, clearSessionCookie } from '../src/utils/cookie-manager';
import { SessionManager } from '../src/oauth-client/session-manager';

describe('POST /oauth/logout', () => {
  let testApp: Hono<{ Bindings: Env }>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    testApp = new Hono<{ Bindings: Env }>();
    testApp.route('/', app);
    
    mockEnv = {
      OAUTH_SESSIONS: {} as any,
      OAUTH_USERS: {} as any,
      AUDIT_LOG: {} as any,
      ADMIN_CONFIG: {} as any,
      OAUTH_CLIENT_ID: 'test-client',
      OAUTH_CLIENT_SECRET: 'test-secret',
    };
  });

  it('should clear cookie and return success when session exists', async () => {
    const mockSessionId = 'valid-session-id-123';
    vi.mocked(getSessionFromCookie).mockReturnValue(mockSessionId);
    
    const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
    vi.mocked(SessionManager).mockImplementation(() => ({
      deleteSession: mockDeleteSession,
    }) as any);

    const response = await testApp.request('/oauth/logout', {
      method: 'POST',
      headers: {
        'Cookie': `pb_session=${mockSessionId}`,
      },
    }, mockEnv);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Logged out successfully'
    });
    
    // Verify session was deleted from KV
    expect(mockDeleteSession).toHaveBeenCalledWith(
      mockSessionId,
      expect.objectContaining({
        correlationId: 'test-correlation-id'
      })
    );
    
    // Verify cookie was cleared
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toContain('pb_session=');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('should return success even when no session cookie exists', async () => {
    vi.mocked(getSessionFromCookie).mockReturnValue(null);
    
    const response = await testApp.request('/oauth/logout', {
      method: 'POST',
    }, mockEnv);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Logged out successfully'
    });
    
    // Verify cookie was still cleared
    expect(clearSessionCookie).toHaveBeenCalled();
    expect(response.headers.get('Set-Cookie')).toContain('pb_session=');
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('should handle session deletion errors gracefully', async () => {
    const mockSessionId = 'valid-session-id-123';
    vi.mocked(getSessionFromCookie).mockReturnValue(mockSessionId);
    
    const mockDeleteSession = vi.fn().mockRejectedValue(new Error('KV error'));
    vi.mocked(SessionManager).mockImplementation(() => ({
      deleteSession: mockDeleteSession,
    }) as any);

    const response = await testApp.request('/oauth/logout', {
      method: 'POST',
      headers: {
        'Cookie': `pb_session=${mockSessionId}`,
      },
    }, mockEnv);

    // Should still return success to prevent information leakage
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Logged out successfully'
    });
    
    // Cookie should still be cleared even if deletion failed
    expect(clearSessionCookie).toHaveBeenCalled();
  });

  it('should complete logout within 50ms', async () => {
    const mockSessionId = 'valid-session-id-123';
    vi.mocked(getSessionFromCookie).mockReturnValue(mockSessionId);
    
    const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
    vi.mocked(SessionManager).mockImplementation(() => ({
      deleteSession: mockDeleteSession,
    }) as any);

    const startTime = performance.now();
    
    await testApp.request('/oauth/logout', {
      method: 'POST',
      headers: {
        'Cookie': `pb_session=${mockSessionId}`,
      },
    }, mockEnv);

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    expect(duration).toBeLessThan(50);
  });
});