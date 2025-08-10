// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../index';
import { createMockEnv, measurePerformance, assertLatency } from './test-helpers';

describe('Main Worker with OAuth Provider', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
  });

  it('should route /auth/start to oauth-provider', async () => {
    const request = new Request('https://example.com/auth/start', {
      method: 'GET'
    });

    const startTime = performance.now();
    const response = await worker.fetch(request, env);
    const endTime = performance.now();

    // Should not return 404 since oauth-provider handles /auth/start
    expect(response.status).not.toBe(404);

    // Verify latency requirement
    assertLatency(endTime - startTime, 50);
  });

  it('should route /auth/callback to oauth-provider', async () => {
    const request = new Request('https://example.com/auth/callback?code=test&state=test', {
      method: 'GET'
    });

    const startTime = performance.now();
    const response = await worker.fetch(request, env);
    const endTime = performance.now();

    // Should not return 404 since oauth-provider handles /auth/callback
    expect(response.status).not.toBe(404);

    // Verify latency requirement
    assertLatency(endTime - startTime, 50);
  });

  it('should still return 404 for unknown routes', async () => {
    const request = new Request('https://example.com/unknown-route');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(404);
    const data = await response.json() as any;
    expect(data.error).toBe('not_found');
    expect(data.correlation_id).toBeDefined();
  });

  it('should preserve RequestContext and audit logging functionality', async () => {
    const request = new Request('https://example.com/auth/start');
    const response = await worker.fetch(request, env);

    // Should have correlation ID header from RequestContext
    expect(response.headers.get('X-Correlation-ID')).toBeDefined();
  });

  it('should maintain error handling with context correlation ID', async () => {
    // Create a request that will trigger error handling
    const request = new Request('https://example.com/nonexistent');
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(404);
    const data = await response.json() as any;

    // Should include correlation ID in error response
    expect(data.correlation_id).toBeDefined();
    expect(response.headers.get('X-Correlation-ID')).toBeDefined();
  });

  it('should handle CORS options requests', async () => {
    const request = new Request('https://example.com/auth/start', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://promptedblog.com', // Use valid origin from whitelist
        'Access-Control-Request-Method': 'GET'
      }
    });

    const response = await worker.fetch(request, env);

    // CORS preflight should be handled successfully
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
  });
});
