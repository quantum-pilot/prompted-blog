// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import app from '../src/routes/oauth.route';
import type { Env } from '../src/oauth-client/types';

// Mock handlers
vi.mock('../src/oauth-client/callback-handler', () => ({
  handleCallbackWithParams: vi.fn(),
}));

vi.mock('../src/utils/request-context', () => ({
  RequestContext: {
    create: vi.fn().mockResolvedValue({
      ip: '192.168.1.1',
      origin: 'http://localhost:3000',
      method: 'POST',
      log: vi.fn(),
    }),
  },
}));

vi.mock('../src/oauth-client/user-manager', () => ({
  UserManager: vi.fn().mockImplementation(() => ({
    findOrCreateUser: vi.fn().mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      picture: 'https://example.com/pic.jpg',
    }),
  })),
}));

vi.mock('../src/oauth-client/session-manager', () => ({
  SessionManager: vi.fn().mockImplementation(() => ({
    createSession: vi.fn().mockResolvedValue('session-id-123'),
  })),
}));

import { handleCallbackWithParams } from '../src/oauth-client/callback-handler';

describe('OAuth Cookie Setting', () => {
  let env: Env;
  let honoApp: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      GOOGLE_CLIENT_ID: 'test-client-id',
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'http://localhost:3000/oauth/callback',
      FRONTEND_URL: 'http://localhost:3000',
      SESSION_ENCRYPTION_KEY: 'test-key-1234567890123456789012',
      SESSION_ENCRYPTION_SALT: 'test-salt',
      ALLOWED_ORIGINS: 'http://localhost:3000',
      ENVIRONMENT: 'development',
      OAUTH_SESSIONS: { put: vi.fn(), get: vi.fn(), delete: vi.fn() } as any,
    };
    honoApp = new Hono<{ Bindings: Env }>();
    honoApp.route('/', app);
  });

  it('sets HttpOnly session cookie on successful OAuth', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        success: true,
        session: { userId: 'user-123', email: 'test@example.com', name: 'Test User', 
                 picture: 'https://example.com/pic.jpg', provider: 'google' },
      }),
      { status: 200 }
    );
    (handleCallbackWithParams as any).mockResolvedValue(mockResponse);

    const request = new Request('http://localhost/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'test-code',
        state: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        code_verifier: btoa(crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, ''))
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
        provider: 'google',
      }),
    });

    const response = await honoApp.fetch(request, env);
    expect(response.status).toBe(200);
    
    const setCookie = response.headers.get('Set-Cookie');
    expect(setCookie).toContain('pb_session=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=86400'); // 1 day
    
    const data = await response.json() as any;
    expect(data.success).toBe(true);
    expect(data.sessionId).toBeDefined(); // Deprecated but present for backward compatibility
  });
});