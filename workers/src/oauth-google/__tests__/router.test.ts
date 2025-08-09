// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env } from '../types';
import router from '../router';

describe('Router', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/oauth/google/callback',
      OAUTH_STATE: {
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
      } as any,
    };
  });

  it('should handle /oauth/google/start route', async () => {
    const request = new Request('https://example.com/oauth/google/start');
    const response = await router(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('accounts.google.com');
  });

  it('should handle /oauth/google/callback route', async () => {
    const request = new Request('https://example.com/oauth/google/callback');
    const response = await router(request, env);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('missing_code');
  });

  it('should handle OPTIONS preflight', async () => {
    const request = new Request('https://example.com/oauth/google/start', {
      method: 'OPTIONS',
    });
    const response = await router(request, env);

    expect(response.status).toBe(204);
  });

  it('should return 404 for unknown routes', async () => {
    const request = new Request('https://example.com/unknown');
    const response = await router(request, env);

    expect(response.status).toBe(404);
    const data = await response.json() as any;
    expect(data.error).toBe('not_found');
  });

  it('should complete routing within 50ms', async () => {
    const request = new Request('https://example.com/unknown');

    const start = performance.now();
    await router(request, env);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });
});
