// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Env, StateData } from '../types';
import { exchangeCodeForToken } from '../token-exchange';
import { createMockEnv, mockGoogleTokenResponse } from './test-helpers';

describe('exchangeCodeForToken', () => {
  let env: Env;

  beforeEach(() => {
    env = createMockEnv();
    vi.clearAllMocks();
  });

  it('should exchange code for token successfully', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockGoogleTokenResponse());
    const stateData: StateData = { codeVerifier: 'test-verifier', timestamp: Date.now() };

    const result = await exchangeCodeForToken('test-code', stateData, env);

    expect(result.access_token).toBe('test-access-token');
    expect(result.token_type).toBe('Bearer');

    const requestBody = (global.fetch as any).mock.calls[0][1].body;
    expect(requestBody).toContain('code_verifier=test-verifier');
    expect(requestBody).not.toContain('client_secret');
  });

  it('should throw error on failed exchange', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid code' }),
        { status: 400 }
      )
    );

    const stateData: StateData = { codeVerifier: 'test-verifier', timestamp: Date.now() };

    await expect(
      exchangeCodeForToken('invalid-code', stateData, env)
    ).rejects.toThrow('Invalid code');
  });

  it('should handle invalid code_verifier error', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid PKCE code_verifier' }),
        { status: 400 }
      )
    );

    const stateData: StateData = { codeVerifier: 'wrong-verifier', timestamp: Date.now() };

    await expect(
      exchangeCodeForToken('valid-code', stateData, env)
    ).rejects.toThrow('Invalid PKCE code_verifier');
  });

  it('should include PKCE verifier in token request', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockGoogleTokenResponse());
    const verifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const stateData: StateData = { codeVerifier: verifier, timestamp: Date.now() };

    await exchangeCodeForToken('test-code', stateData, env);

    const params = new URLSearchParams((global.fetch as any).mock.calls[0][1].body);
    expect(params.get('code_verifier')).toBe(verifier);
    expect(params.get('grant_type')).toBe('authorization_code');
    expect(params.get('code')).toBe('test-code');
    expect(params.get('client_id')).toBe('test-client-id');
    expect(params.has('client_secret')).toBe(false);
  });

  it('should handle missing code_verifier in state data', async () => {
    const invalidStateData = { timestamp: Date.now() } as any;

    await expect(
      exchangeCodeForToken('test-code', invalidStateData, env)
    ).rejects.toThrow();
  });

  it('should complete within 50ms (mocked)', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockGoogleTokenResponse());
    const stateData: StateData = { codeVerifier: 'verifier', timestamp: Date.now() };

    const start = performance.now();
    await exchangeCodeForToken('code', stateData, env);
    expect(performance.now() - start).toBeLessThan(50);
  });

  it('should handle response with refresh_token', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(mockGoogleTokenResponse());
    const stateData: StateData = { codeVerifier: 'test-verifier', timestamp: Date.now() };

    const result = await exchangeCodeForToken('test-code', stateData, env);

    expect(result.refresh_token).toBe('test-refresh-token');
    expect(result.access_token).toBe('test-access-token');
  });
});
