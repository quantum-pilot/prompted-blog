// @agent: cloudflare-backend
/**
 * Tests for Hono middleware
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { corsMiddleware } from '../cors.middleware';
import { securityMiddleware } from '../security.middleware';
import { rateLimitMiddleware } from '../rate-limit.middleware';
import { authMiddleware, optionalAuthMiddleware } from '../auth.middleware';
import type { Env } from '../../oauth-client/types';

describe('Hono Middleware Tests', () => {
  let app: Hono<{ Bindings: Env }>;
  let mockEnv: Env;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    mockEnv = {
      OAUTH_SESSIONS: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      } as any,
      RATE_LIMITER_KV: {
        get: async () => null,
        put: async () => {},
        delete: async () => {},
      } as any,
      AUDIT_LOGS: {
        put: async () => {},
      } as any,
      ALLOWED_ORIGINS: 'https://promptedblog.com',
    } as Env;
  });

  describe('CORS Middleware', () => {
    it('should handle OPTIONS preflight requests', async () => {
      app.use('*', corsMiddleware());
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com',
        },
      }, mockEnv);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
    });

    it('should add CORS headers to regular requests', async () => {
      app.use('*', corsMiddleware());
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {
        headers: {
          'Origin': 'https://promptedblog.com',
        },
      }, mockEnv);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
    });
  });

  describe('Security Middleware', () => {
    it('should add security headers to responses', async () => {
      app.use('*', securityMiddleware());
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {}, mockEnv);

      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    });
  });

  describe('Rate Limit Middleware', () => {
    it('should pass requests when KV is not configured', async () => {
      const envWithoutKV = { ...mockEnv, RATE_LIMITER_KV: undefined } as any;
      
      app.use('*', rateLimitMiddleware(1, 1000));
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {
        headers: {
          'CF-Connecting-IP': '127.0.0.1',
        },
      }, envWithoutKV);

      expect(response.status).toBe(200);
    });
  });

  describe('Auth Middleware', () => {
    it('should reject requests without Bearer token', async () => {
      app.use('*', authMiddleware());
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {}, mockEnv);

      expect(response.status).toBe(401);
      const data = await response.json() as any;
      expect(data.error).toBe('unauthorized');
    });

    it('should pass through with optional auth when no token', async () => {
      app.use('*', optionalAuthMiddleware());
      app.get('/test', (c) => c.text('OK'));

      const response = await app.request('/test', {}, mockEnv);

      expect(response.status).toBe(200);
    });
  });
});