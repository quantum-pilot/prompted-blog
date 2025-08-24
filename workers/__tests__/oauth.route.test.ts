// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import app from '../src/routes/oauth.route';
import type { Env } from '../src/oauth-client/types';

// Mock the handlers
vi.mock('../src/oauth-client/auth-handler', () => ({
  handleInitiateOAuth: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ authorizationUrl: 'https://example.com' }), { status: 200 })
  ),
}));

vi.mock('../src/oauth-client/callback-handler', () => ({
  handleCallbackWithParams: vi.fn(),
}));

vi.mock('../src/utils/request-context', () => ({
  RequestContext: {
    create: vi.fn().mockResolvedValue({
      ip: '192.168.1.1',
      origin: 'http://localhost:3000',
      method: 'POST',
      log: vi.fn(), // Add the log function mock
    }),
  },
}));

// Import mocked functions
import { handleCallbackWithParams } from '../src/oauth-client/callback-handler';

// Mock user manager and session manager to avoid database calls
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

// Helper to generate valid base64URL state
const generateValidState = (): string => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Helper to generate valid PKCE verifier
const generateValidVerifier = (): string => {
  const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

describe('OAuth Route Cookie Setting', () => {
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
      OAUTH_SESSIONS: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      } as any,
    };

    honoApp = new Hono<{ Bindings: Env }>();
    honoApp.route('/', app);
  });

  describe('POST /oauth/callback with cookie setting', () => {
    it('should set HttpOnly session cookie on successful OAuth', async () => {
      // Mock successful OAuth response with session data
      const mockSession = {
        userId: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg',
        provider: 'google',
      };

      const mockResponse = new Response(
        JSON.stringify({
          success: true,
          session: mockSession,
        }),
        { status: 200 }
      );

      (handleCallbackWithParams as any).mockResolvedValue(mockResponse);

      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'test-code',
          state: generateValidState(),
          code_verifier: generateValidVerifier(),
          provider: 'google',
        }),
      });

      const response = await honoApp.fetch(request, env);
      
      // Debug: log the response if not 200
      if (response.status !== 200) {
        const errorData = await response.clone().json();
        console.log('Error response:', errorData);
      }
      
      expect(response.status).toBe(200);
      
      // Check that Set-Cookie header is present
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('pb_session=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
      expect(setCookie).toContain('Max-Age=86400'); // 1 day
      
      // Response should still include success and user data for backward compatibility
      const data = await response.json() as any;
      expect(data.success).toBe(true);
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('test@example.com');
      
      // sessionId should be present but marked deprecated
      expect(data.sessionId).toBeDefined();
    });

    it('should not set cookie on OAuth failure', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          success: false,
          error: 'invalid_grant',
          error_description: 'Invalid authorization code',
        }),
        { status: 400 }
      );

      (handleCallbackWithParams as any).mockResolvedValue(mockResponse);

      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'invalid-code',
          state: generateValidState(),
          code_verifier: generateValidVerifier(),
          provider: 'google',
        }),
      });

      const response = await honoApp.fetch(request, env);
      
      expect(response.status).toBe(400);
      
      // Should not set cookie on failure
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeNull();
      
      const data = await response.json() as any;
      expect(data.success).toBe(false);
      expect(data.error).toBe('invalid_grant');
    });

    it('should complete within 50ms latency requirement', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          success: true,
          session: {
            userId: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'https://example.com/pic.jpg',
            provider: 'google',
          },
        }),
        { status: 200 }
      );

      (handleCallbackWithParams as any).mockResolvedValue(mockResponse);

      const request = new Request('http://localhost/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'test-code',
          state: generateValidState(),
          code_verifier: generateValidVerifier(),
          provider: 'google',
        }),
      });

      const start = Date.now();
      await honoApp.fetch(request, env);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });
});