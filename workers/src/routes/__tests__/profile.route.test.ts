// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../oauth-client/types';
import profileRoutes from '../profile.route';
import { ProfileHandler } from '../../oauth-client/profile-handler';

// Mock ProfileHandler
const mockGetProfile = vi.fn();
const mockUpdateProfile = vi.fn();
const mockCheckUsernameAvailability = vi.fn();

vi.mock('../../oauth-client/profile-handler', () => ({
  ProfileHandler: vi.fn().mockImplementation(() => ({
    getProfile: mockGetProfile,
    updateProfile: mockUpdateProfile,
    checkUsernameAvailability: mockCheckUsernameAvailability,
  })),
}));

// Mock RequestContext
vi.mock('../../utils/request-context', () => ({
  RequestContext: {
    create: vi.fn().mockResolvedValue({
      log: vi.fn(),
      requestId: 'test-request-id',
    }),
  },
}));

describe('Profile Routes', () => {
  let app: Hono<{ Bindings: Env }>;
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env }>();
    app.route('/', profileRoutes);
    
    mockEnv = {
      USER_INDEX: {} as any,
      USERNAME_INDEX: {} as any,
      SESSION_STORE: {} as any,
      RATE_LIMITER: {} as any,
      OAUTH_STATE_STORE: {} as any,
      PKCE_STORE: {} as any,
      OAUTH_SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      } as any,
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      GITHUB_CLIENT_ID: 'test-github-id',
      GITHUB_CLIENT_SECRET: 'test-github-secret',
      OAUTH_REDIRECT_URI: 'https://test.com/callback',
      JWT_SECRET: 'test-secret',
      SESSION_SECRET: 'test-session-secret',
    };
  });

  describe('GET /api/profile', () => {
    it('should return 401 when no auth token provided', async () => {
      const request = new Request('http://localhost/api/profile');
      const response = await app.fetch(request, mockEnv);
      
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data).toEqual({
        error: 'unauthorized',
        error_description: 'Authentication required',
      });
    });

    it('should return user profile when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
        username: 'testuser',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      mockGetProfile.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      
      // Set up authenticated context
      const authenticatedApp = new Hono<{ Bindings: Env; Variables: any }>();
      authenticatedApp.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        c.set('userEmail', 'test@example.com');
        await next();
      });
      authenticatedApp.route('/', profileRoutes);
      
      const request = new Request('http://localhost/api/profile');
      const response = await authenticatedApp.fetch(request, mockEnv);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true, user: mockUser });
    });

    it('should handle profile not found', async () => {
      mockGetProfile.mockResolvedValue({
        success: false,
        error: 'user_not_found',
        error_description: 'User profile not found',
      });
      
      const authenticatedApp = new Hono<{ Bindings: Env; Variables: any }>();
      authenticatedApp.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        await next();
      });
      authenticatedApp.route('/', profileRoutes);
      
      const request = new Request('http://localhost/api/profile');
      const response = await authenticatedApp.fetch(request, mockEnv);
      
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('user_not_found');
    });
  });

  describe('PUT /api/profile', () => {
    it('should require authentication', async () => {
      const request = new Request('http://localhost/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'newuser' }),
      });
      
      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(401);
    });

    it('should update profile with valid username', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        provider: 'google',
        username: 'newuser',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      mockUpdateProfile.mockResolvedValue({
        success: true,
        user: mockUser,
      });
      
      const authenticatedApp = new Hono<{ Bindings: Env; Variables: any }>();
      authenticatedApp.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        await next();
      });
      authenticatedApp.route('/', profileRoutes);
      
      const request = new Request('http://localhost/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'newuser' }),
      });
      
      const response = await authenticatedApp.fetch(request, mockEnv);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true, user: mockUser });
    });

    it('should handle username taken error', async () => {
      mockUpdateProfile.mockResolvedValue({
        success: false,
        error: 'username_taken',
        error_description: 'Username is already taken',
      });
      
      const authenticatedApp = new Hono<{ Bindings: Env; Variables: any }>();
      authenticatedApp.use('*', async (c, next) => {
        c.set('userId', 'user-123');
        await next();
      });
      authenticatedApp.route('/', profileRoutes);
      
      const request = new Request('http://localhost/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'taken' }),
      });
      
      const response = await authenticatedApp.fetch(request, mockEnv);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toBe('username_taken');
    });
  });

  describe('GET /api/username/check/:username', () => {
    it('should check username availability without auth', async () => {
      mockCheckUsernameAvailability.mockResolvedValue({
        success: true,
        available: true,
      });
      
      const request = new Request('http://localhost/api/username/check/newuser');
      const response = await app.fetch(request, mockEnv);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true, available: true });
    });

    it('should handle invalid username format', async () => {
      mockCheckUsernameAvailability.mockResolvedValue({
        success: false,
        error: 'username_invalid',
        error_description: 'Invalid username format',
      });
      
      const request = new Request('http://localhost/api/username/check/invalid--name');
      const response = await app.fetch(request, mockEnv);
      
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('username_invalid');
    });

    it('should handle unavailable username', async () => {
      mockCheckUsernameAvailability.mockResolvedValue({
        success: true,
        available: false,
      });
      
      const request = new Request('http://localhost/api/username/check/taken');
      const response = await app.fetch(request, mockEnv);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ success: true, available: false });
    });
  });

  describe('Performance', () => {
    it('should respond within 50ms', async () => {
      mockCheckUsernameAvailability.mockResolvedValue({
        success: true,
        available: true,
      });
      
      const start = performance.now();
      const request = new Request('http://localhost/api/username/check/test');
      await app.fetch(request, mockEnv);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });
  });
});