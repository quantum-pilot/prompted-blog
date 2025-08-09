// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env } from '../types';
import { handleOAuthCallback } from '../handlers';
import { createMockEnv, createCallbackURL, measurePerformance, assertLatency } from './test-helpers';

describe('handleOAuthCallback', () => {
  let env: Env;
  beforeEach(() => {
    env = createMockEnv();
    vi.clearAllMocks();
  });
  const expectError = async (url: URL, expectedError: string, expectedStatus = 400) => {
    const response = await handleOAuthCallback(url, env);
    expect(response.status).toBe(expectedStatus);
    const data = await response.json() as any;
    expect(data.error).toBe(expectedError);
  };
  it('should handle OAuth errors', async () => {
    const url = createCallbackURL({ error: 'access_denied', error_description: 'User denied' });
    await expectError(url, 'access_denied');
  });
  it('should validate required parameters', async () => {
    await expectError(createCallbackURL({}), 'missing_code');
  });
  it('should validate state parameter', async () => {
    await expectError(createCallbackURL({ code: 'test-code' }), 'missing_state');
  });
  it('should handle invalid state', async () => {
    (env.OAUTH_STATE.get as any).mockResolvedValueOnce(null);
    await expectError(createCallbackURL({ code: 'test-code', state: 'invalid' }), 'invalid_state');
  });
  it('should complete within 50ms for validation errors', async () => {
    const { duration } = await measurePerformance(() => handleOAuthCallback(createCallbackURL({}), env));
    assertLatency(duration, 50);
  });
  const mockSuccessfulExchange = () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'test-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      })));
  };
  it('should successfully exchange code with valid PKCE verifier', async () => {
    const state = 'test-state-123';
    const codeVerifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    (env.OAUTH_STATE.get as any).mockResolvedValueOnce(JSON.stringify({
      codeVerifier,
      timestamp: Date.now(),
    }));
    mockSuccessfulExchange();
    const url = createCallbackURL({ code: 'test-code', state });
    const response = await handleOAuthCallback(url, env);
    expect(response.status).toBe(302);
    // Verify PKCE parameters in token exchange
    const params = new URLSearchParams((global.fetch as any).mock.calls[0][1].body);
    expect(params.get('code_verifier')).toBe(codeVerifier);
    expect(params.get('code')).toBe('test-code');
    expect(params.has('client_secret')).toBe(false);
  });
  it('should handle expired state gracefully', async () => {
    const state = 'expired-state';
    (env.OAUTH_STATE.get as any).mockResolvedValueOnce(JSON.stringify({
      codeVerifier: 'test-verifier',
      timestamp: Date.now() - 15 * 60 * 1000, // 15 minutes ago
    }));
    const url = createCallbackURL({ code: 'test-code', state });
    const response = await handleOAuthCallback(url, env);
    // Should still proceed but log warning
    expect(env.OAUTH_STATE.get).toHaveBeenCalledWith(`state:${state}`);
  });
  it('should clean up state after successful callback', async () => {
    const state = 'test-state-cleanup';
    (env.OAUTH_STATE.get as any).mockResolvedValueOnce(JSON.stringify({
      codeVerifier: 'test-verifier',
      timestamp: Date.now(),
    }));
    mockSuccessfulExchange();
    const url = createCallbackURL({ code: 'test-code', state });
    await handleOAuthCallback(url, env);
    expect(env.OAUTH_STATE.delete).toHaveBeenCalledWith(`state:${state}`);
  });
});
