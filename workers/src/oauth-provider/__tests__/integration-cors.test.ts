// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { createMockEnv } from './test-helpers';

describe('Google OAuth Worker - CORS Integration', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
  });

  describe('CORS preflight handling', () => {
    it('should handle OPTIONS preflight at worker level', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com',
          'Access-Control-Request-Method': 'POST',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should handle CORS preflight requests from allowed origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com'
        }
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not include CORS headers for non-whitelisted origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil.com',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should not set CORS headers for non-whitelisted origins', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com'
        }
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('should not set CORS headers when no origin is provided', async () => {
      const request = new Request('https://example.com/oauth/google/start', {
        method: 'OPTIONS',
      });
      const response = await worker.fetch(request, env);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Methods')).toBeNull();
    });
  });

  describe('CORS in responses', () => {
    it('should include CORS headers in error responses', async () => {
      const request = new Request('https://example.com/nonexistent', {
        headers: {
          'Origin': 'https://promptedblog.com',
        },
      });

      const response = await worker.fetch(request, env);

      expect(response.status).toBe(404);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
    });
  });
});
