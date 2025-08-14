// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { errorResponse } from '../cors';
import { applySecurityHeaders } from '../../utils/security-headers';
import { Router } from '../router';
import type { Env } from '../types';
import { RequestContext } from '../../utils/request-context';

describe('Security Headers Integration', () => {
  describe('errorResponse', () => {
    it('should include security headers in error responses', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'http://localhost:3000,http://localhost:5173',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      const response = errorResponse('test_error', 'Test error message', 400, 'http://localhost:3000', undefined, mockEnv);
      
      // Check security headers
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'; frame-ancestors 'none';");
      expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
      expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
      
      // Check original headers are preserved
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });
  });

  describe('Router responses', () => {
    it('should apply security headers to handler responses', async () => {
      const router = new Router();
      const mockEnv: Env = {
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test-client-id',
        CLIENT_ID: 'test-client-id',
        REDIRECT_URI: 'http://localhost:3000/callback',
        FRONTEND_URL: 'http://localhost:3000',
        SESSION_ENCRYPTION_KEY: 'test-key'
      };
      
      const mockContext = {
        correlationId: 'test-id',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        requestId: 'req-id',
        userId: null,
        sessionId: null,
        log: () => {}
      } as RequestContext;

      router.get('/test', () => {
        return new Response(JSON.stringify({ message: 'test' }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      });

      const request = new Request('http://localhost/test', { method: 'GET' });
      const response = await router.handle(request, mockEnv, mockContext);
      
      expect(response).not.toBeNull();
      if (response) {
        // Check security headers
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'; frame-ancestors 'none';");
        expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
        expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
        
        // Check original headers are preserved
        expect(response.headers.get('Content-Type')).toBe('application/json');
      }
    });

    it('should apply security headers to async handler responses', async () => {
      const router = new Router();
      const mockEnv: Env = {
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test-client-id',
        CLIENT_ID: 'test-client-id',
        REDIRECT_URI: 'http://localhost:3000/callback',
        FRONTEND_URL: 'http://localhost:3000',
        SESSION_ENCRYPTION_KEY: 'test-key'
      };
      
      const mockContext = {
        correlationId: 'test-id',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        requestId: 'req-id',
        userId: null,
        sessionId: null,
        log: () => {}
      } as RequestContext;

      router.get('/test-async', async () => {
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1));
        return new Response(JSON.stringify({ async: true }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Custom-Header': 'custom-value'
          }
        });
      });

      const request = new Request('http://localhost/test-async', { method: 'GET' });
      const response = await router.handle(request, mockEnv, mockContext);
      
      expect(response).not.toBeNull();
      if (response) {
        expect(response.status).toBe(200);
        
        // Check security headers
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
        expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
        expect(response.headers.get('Content-Security-Policy')).toBe("default-src 'self'; frame-ancestors 'none';");
        expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
        expect(response.headers.get('Permissions-Policy')).toBe('geolocation=(), microphone=(), camera=()');
        
        // Check original headers are preserved
        expect(response.headers.get('Content-Type')).toBe('application/json');
        expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
      }
    });
  });
});