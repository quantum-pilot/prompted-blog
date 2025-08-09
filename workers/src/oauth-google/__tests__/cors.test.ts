import { describe, it, expect } from 'vitest';
import { getCorsHeaders, handleCorsOptions, jsonResponse, errorResponse } from '../cors';

describe('CORS Security Fix', () => {
  describe('getCorsHeaders', () => {
    it('should return CORS headers for whitelisted origin https://promptedblog.com', () => {
      const headers = getCorsHeaders('https://promptedblog.com');

      expect(headers['Access-Control-Allow-Origin']).toBe('https://promptedblog.com');
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
      expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('should return CORS headers for whitelisted origin http://localhost:8000', () => {
      const headers = getCorsHeaders('http://localhost:8000');

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:8000');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should return empty object for non-whitelisted origins', () => {
      const headers1 = getCorsHeaders('https://evil-site.com');
      const headers2 = getCorsHeaders('http://malicious.com');
      const headers3 = getCorsHeaders('https://not-allowed.org');

      expect(headers1).toEqual({});
      expect(headers2).toEqual({});
      expect(headers3).toEqual({});
    });

    it('should return empty object for null origin', () => {
      const headers = getCorsHeaders(null);
      expect(headers).toEqual({});
    });

    it('should return empty object for empty string origin', () => {
      const headers = getCorsHeaders('');
      expect(headers).toEqual({});
    });

    it('should not use wildcard origin', () => {
      // Ensure the vulnerable wildcard is never returned
      const headers1 = getCorsHeaders('https://promptedblog.com');
      const headers2 = getCorsHeaders('http://localhost:8000');

      expect(headers1['Access-Control-Allow-Origin']).not.toBe('*');
      expect(headers2['Access-Control-Allow-Origin']).not.toBe('*');
    });
  });

  describe('handleCorsOptions', () => {
    it('should handle OPTIONS preflight for allowed origin', () => {
      const request = new Request('https://example.com/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com'
        }
      });

      const response = handleCorsOptions(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not set CORS headers for non-whitelisted origin', () => {
      const request = new Request('https://example.com/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://evil-site.com'
        }
      });

      const response = handleCorsOptions(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });

    it('should handle OPTIONS without origin header', () => {
      const request = new Request('https://example.com/test', {
        method: 'OPTIONS'
      });

      const response = handleCorsOptions(request);

      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });

    it('should complete within 50ms', () => {
      const request = new Request('https://example.com/test', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://promptedblog.com'
        }
      });

      const start = performance.now();
      handleCorsOptions(request);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('jsonResponse with CORS', () => {
    it('should include CORS headers for allowed origin', () => {
      const response = jsonResponse(
        { success: true },
        200,
        {},
        'https://promptedblog.com'
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://promptedblog.com');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should not include CORS headers for non-whitelisted origin', () => {
      const response = jsonResponse(
        { success: true },
        200,
        {},
        'https://hacker.com'
      );

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should work without origin parameter', () => {
      const response = jsonResponse({ success: true });

      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('errorResponse with CORS', () => {
    it('should include CORS headers for allowed origin in error responses', () => {
      const response = errorResponse(
        'invalid_request',
        'Missing required parameter',
        400,
        'http://localhost:8000'
      );

      expect(response.status).toBe(400);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8000');
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    });

    it('should not include CORS headers for non-whitelisted origin in error responses', () => {
      const response = errorResponse(
        'invalid_request',
        'Missing required parameter',
        400,
        'https://attacker.com'
      );

      expect(response.status).toBe(400);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
      expect(response.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    });
  });

  describe('Security Validation', () => {
    it('should never return wildcard origin for any input', () => {
      const testOrigins = [
        'https://promptedblog.com',
        'http://localhost:8000',
        'https://evil.com',
        null,
        '',
        undefined as any,
        '*',
        'https://promptedblog.com.evil.com',
        'https://localhost:8000',
        'http://promptedblog.com'
      ];

      testOrigins.forEach(origin => {
        const headers = getCorsHeaders(origin);
        if (headers['Access-Control-Allow-Origin']) {
          expect(headers['Access-Control-Allow-Origin']).not.toBe('*');
        }
      });
    });

    it('should be case-sensitive for origin matching', () => {
      const headers1 = getCorsHeaders('https://PROMPTEDBLOG.com');
      const headers2 = getCorsHeaders('HTTPS://promptedblog.com');
      const headers3 = getCorsHeaders('https://PromptedBlog.com');

      // These should all be rejected due to case mismatch
      expect(headers1).toEqual({});
      expect(headers2).toEqual({});
      expect(headers3).toEqual({});
    });

    it('should not allow subdomain variations', () => {
      const headers1 = getCorsHeaders('https://www.promptedblog.com');
      const headers2 = getCorsHeaders('https://api.promptedblog.com');
      const headers3 = getCorsHeaders('https://subdomain.promptedblog.com');

      expect(headers1).toEqual({});
      expect(headers2).toEqual({});
      expect(headers3).toEqual({});
    });

    it('should not allow port variations for production domain', () => {
      const headers1 = getCorsHeaders('https://promptedblog.com:443');
      const headers2 = getCorsHeaders('https://promptedblog.com:8080');

      expect(headers1).toEqual({});
      expect(headers2).toEqual({});
    });

    it('should only allow exact localhost:8000 for development', () => {
      const headers1 = getCorsHeaders('http://localhost:3000');
      const headers2 = getCorsHeaders('http://localhost:8080');
      const headers3 = getCorsHeaders('http://127.0.0.1:8000');
      const headers4 = getCorsHeaders('https://localhost:8000'); // https instead of http

      expect(headers1).toEqual({});
      expect(headers2).toEqual({});
      expect(headers3).toEqual({});
      expect(headers4).toEqual({});
    });
  });
});
