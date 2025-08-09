// @agent: cloudflare-backend
import { vi, expect } from 'vitest';
import type { Env } from '../types';

/** Creates a mock KV namespace with common methods */
export function createMockKV() {
  return { get: vi.fn(), put: vi.fn(), delete: vi.fn(), list: vi.fn(), getWithMetadata: vi.fn() };
}

/** Creates a mock environment configuration for tests */
export function createMockEnv(): Env {
  return {
    CLIENT_ID: 'test-client-id',
    REDIRECT_URI: 'https://example.com/oauth/callback',
    OAUTH_STATE: createMockKV() as any,
  };
}

/** Creates a mock Google token response */
export function mockGoogleTokenResponse(overrides = {}) {
  return new Response(JSON.stringify({
    access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600,
    refresh_token: 'test-refresh-token', scope: 'openid profile email',
    id_token: 'test-id-token', ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** Creates a mock Google user info response */
export function mockGoogleUserInfoResponse(overrides = {}) {
  return new Response(JSON.stringify({
    id: 'test-user-id', email: 'test@example.com', verified_email: true,
    name: 'Test User', given_name: 'Test', family_name: 'User',
    picture: 'https://example.com/photo.jpg', locale: 'en', ...overrides,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** Creates an OAuth authorization request */
export function createAuthRequest(origin = 'https://promptedblog.com'): Request {
  return new Request('https://example.com/oauth/google/start', {
    headers: origin ? { Origin: origin } : {},
  });
}

/** Creates an OAuth callback request with code and state */
export function createCallbackRequest(code: string, state: string, origin?: string): Request {
  const url = `https://example.com/oauth/google/callback?code=${code}&state=${state}`;
  return new Request(url, { headers: origin ? { Origin: origin } : {} });
}

/** Creates a callback URL with query parameters */
export function createCallbackURL(params: Record<string, string> = {}): URL {
  const url = new URL('https://example.com/oauth/google/callback');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

/** Creates a token refresh request */
export function createTokenRequest(refreshToken: string): Request {
  return new Request('https://example.com/oauth/google/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Measures the performance of a function */
export async function measurePerformance<T>(
  fn: () => T | Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  return { result, duration: performance.now() - start };
}

/** Asserts that an operation completes within the latency budget */
export function assertLatency(duration: number, maxMs = 50): void {
  expect(duration).toBeLessThan(maxMs);
}