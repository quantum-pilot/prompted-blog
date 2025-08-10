// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../index';
import { createMockEnv, measurePerformance, assertLatency } from './test-helpers';

describe('Google OAuth Worker - Routing and Performance', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('Invalid routes', () => {
    it('should return 404 for unknown routes', async () => {
      const request = new Request('https://example.com/unknown');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      const data = await response.json() as any;
      expect(data.error).toBe('not_found');
    });

    it('should return 404 for invalid OAuth paths', async () => {
      const request = new Request('https://example.com/oauth/google/invalid');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      const data = await response.json() as any;
      expect(data.error).toBe('not_found');
    });

    it('should return 404 for root path', async () => {
      const request = new Request('https://example.com/');
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      const data = await response.json() as any;
      expect(data.error).toBe('not_found');
    });
  });

  describe('Performance', () => {
    it('should handle start request in under 50ms', async () => {
      const request = new Request('https://example.com/oauth/google/start');
      const { duration } = await measurePerformance(() => worker.fetch(request, env));

      assertLatency(duration, 50);
    });

    it('should handle callback request in under 50ms', async () => {
      const request = new Request('https://example.com/oauth/google/callback?code=test&state=test');
      const { duration } = await measurePerformance(() => worker.fetch(request, env));

      assertLatency(duration, 50);
    });

    it('should handle 404 errors in under 50ms', async () => {
      const request = new Request('https://example.com/unknown');
      const { duration } = await measurePerformance(() => worker.fetch(request, env));

      assertLatency(duration, 50);
    });
  });
});
