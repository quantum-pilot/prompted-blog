// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { createMockEnv } from './test-helpers';

describe('Google OAuth Worker - /oauth/google/callback Endpoint', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should exchange code for token and get user info', async () => {
    const state = 'test-state-123';
    const codeVerifier = 'test-verifier-456';

    // Mock stored state
    env.OAUTH_STATE.get.mockResolvedValue(JSON.stringify({
      codeVerifier,
      timestamp: Date.now(),
    }));

    // Mock token exchange
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'test-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: 'test-id-token',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/photo.jpg',
      })));

    const request = new Request(`https://example.com/oauth/google/callback?code=test-code&state=${state}`);
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('/oauth/callback');
    expect(location).toContain('user=');

    // Verify state was deleted after successful auth
    expect(env.OAUTH_STATE.delete).toHaveBeenCalledWith(`state:${state}`);
  });

  it('should handle missing authorization code', async () => {
    const request = new Request('https://example.com/oauth/google/callback');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('missing_code');
  });

  it('should handle invalid state', async () => {
    env.OAUTH_STATE.get.mockResolvedValue(null);

    const request = new Request('https://example.com/oauth/google/callback?code=test-code&state=invalid-state');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('invalid_state');
  });

  it('should handle OAuth error responses', async () => {
    const request = new Request('https://example.com/oauth/google/callback?error=access_denied&error_description=User+denied+access');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toBe('access_denied');
    expect(data.error_description).toBe('User denied access');
  });

  it('should handle token exchange failure', async () => {
    const state = 'test-state-123';
    env.OAUTH_STATE.get.mockResolvedValue(JSON.stringify({
      codeVerifier: 'test-verifier',
      timestamp: Date.now(),
    }));

    global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'Invalid authorization code',
    }), { status: 400 }));

    const request = new Request(`https://example.com/oauth/google/callback?code=invalid-code&state=${state}`);
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(500);
    const data = await response.json() as any;
    expect(data.error).toBe('internal_error');
  });

  it('should handle PKCE verification failure', async () => {
    const state = 'test-state-pkce-fail';
    env.OAUTH_STATE.get.mockResolvedValue(JSON.stringify({
      codeVerifier: 'wrong-verifier',
      timestamp: Date.now(),
    }));

    global.fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'PKCE verification failed',
    }), { status: 400 }));

    const request = new Request(`https://example.com/oauth/google/callback?code=test-code&state=${state}`);
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(500);
    const data = await response.json() as any;
    expect(data.error).toBe('internal_error');
  });

});
