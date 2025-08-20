// @agent: cloudflare-backend
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import app from '../src/routes/profile.route';
import type { Env } from '../src/oauth-client/types';

// Mock environment
const mockEnv: Env = {
  OAUTH_SESSIONS: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
    getWithMetadata: vi.fn(),
  } as any,
  OAUTH_PROVIDERS: {} as any,
  USER_INDEX: {} as any,
};

describe('Profile Route Rate Limiting', () => {
  it('should apply rate limiting to username check endpoint', async () => {
    const request = new Request('http://localhost/api/username/check/testuser', {
      headers: { 'CF-Connecting-IP': '192.168.1.1' }
    });

    // Mock KV for rate limiter - simulate rate limit exceeded
    (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(
      JSON.stringify({ requests: Array(11).fill(Date.now()) }) // 11 requests (over limit of 10)
    );

    const response = await app.fetch(request, mockEnv);
    
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'rate_limit');
  });

  it('should allow requests within rate limit', async () => {
    const request = new Request('http://localhost/api/username/check/testuser', {
      headers: { 'CF-Connecting-IP': '192.168.1.2' }
    });

    // Mock KV for rate limiter - under limit
    (mockEnv.OAUTH_SESSIONS.get as any)
      .mockResolvedValueOnce(JSON.stringify({ requests: [Date.now() - 1000] })) // Rate limit check
      .mockResolvedValueOnce(null) // Username index check
      .mockResolvedValueOnce(null); // Reservation check

    // Mock the put for rate limit update
    (mockEnv.OAUTH_SESSIONS.put as any).mockResolvedValue(undefined);

    const response = await app.fetch(request, mockEnv);
    
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('available');
  });

  it('should apply strict rate limit to profile updates', async () => {
    const request = new Request('http://localhost/api/profile', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.168.1.1'
      },
      body: JSON.stringify({ username: 'newusername' })
    });

    // Mock authenticated user
    const authedApp = new Hono<{ Bindings: typeof mockEnv }>()
      .use('*', async (c, next) => {
        c.set('userId' as any, 'user-123');
        await next();
      })
      .route('/', app);

    // Mock rate limit exceeded (6 requests in last hour, limit is 5)
    (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(
      JSON.stringify({ requests: Array(6).fill(Date.now() - 1000) })
    );

    const response = await authedApp.fetch(request, mockEnv);
    
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toHaveProperty('error', 'rate_limit');
    expect(body.error_description).toContain('username update');
  });

  it('should handle missing CF-Connecting-IP in test mode', async () => {
    const request = new Request('http://localhost/api/username/check/testuser', {
      // No CF-Connecting-IP header
    });

    // In test mode, should use fallback IP
    (mockEnv.OAUTH_SESSIONS.get as any)
      .mockResolvedValueOnce(null) // Rate limit check
      .mockResolvedValueOnce(null) // Username index
      .mockResolvedValueOnce(null); // Reservation

    (mockEnv.OAUTH_SESSIONS.put as any).mockResolvedValue(undefined);

    const response = await app.fetch(request, mockEnv);
    
    // Should not fail in test mode
    expect(response.status).toBe(200);
  });

  it('should complete requests within 50ms performance target', async () => {
    const request = new Request('http://localhost/api/username/check/testuser', {
      headers: { 'CF-Connecting-IP': '192.168.1.3' }
    });

    // Mock fast responses
    (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);
    (mockEnv.OAUTH_SESSIONS.put as any).mockResolvedValue(undefined);

    const startTime = Date.now();
    const response = await app.fetch(request, mockEnv);
    const elapsed = Date.now() - startTime;

    expect(response.status).toBe(200);
    // Should complete around 50ms due to constant-time response
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(100);
  });
});