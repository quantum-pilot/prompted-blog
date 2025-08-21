// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  setSessionCookie, 
  getSessionFromCookie, 
  clearSessionCookie,
  COOKIE_NAME,
  MAX_AGE
} from '../cookie-manager';

describe('Cookie Manager', () => {
  describe('setSessionCookie', () => {
    it('should create secure session cookie for production', () => {
      const sessionId = 'test-session-id-1234567890abcdef';
      const env = { ENVIRONMENT: 'production' } as any;
      
      const headers = setSessionCookie(sessionId, env);
      const cookieHeader = headers.get('Set-Cookie');
      
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(`${COOKIE_NAME}=${sessionId}`);
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('Secure');
      expect(cookieHeader).toContain('SameSite=Strict');
      expect(cookieHeader).toContain('Path=/');
      expect(cookieHeader).toContain(`Max-Age=${MAX_AGE}`);
      expect(cookieHeader).toContain('Domain=.promptedblog.com');
    });

    it('should create non-secure cookie for localhost development', () => {
      const sessionId = 'dev-session-id-9876543210fedcba';
      const env = { ENVIRONMENT: 'development' } as any;
      
      const headers = setSessionCookie(sessionId, env);
      const cookieHeader = headers.get('Set-Cookie');
      
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(`${COOKIE_NAME}=${sessionId}`);
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).not.toContain('Secure');
      expect(cookieHeader).toContain('SameSite=Strict');
      expect(cookieHeader).toContain('Path=/');
      expect(cookieHeader).toContain(`Max-Age=${MAX_AGE}`);
      expect(cookieHeader).not.toContain('Domain=');
    });

    it('should handle session IDs of various lengths', () => {
      const shortSessionId = 'a'.repeat(32);
      const longSessionId = 'b'.repeat(128);
      const env = { ENVIRONMENT: 'production' } as any;
      
      const shortHeaders = setSessionCookie(shortSessionId, env);
      const longHeaders = setSessionCookie(longSessionId, env);
      
      expect(shortHeaders.get('Set-Cookie')).toContain(`${COOKIE_NAME}=${shortSessionId}`);
      expect(longHeaders.get('Set-Cookie')).toContain(`${COOKIE_NAME}=${longSessionId}`);
    });
  });

  describe('getSessionFromCookie', () => {
    it('should extract session ID from single cookie', () => {
      const sessionId = 'test-session-id-1234567890abcdef';
      const request = new Request('https://example.com', {
        headers: {
          'Cookie': `${COOKIE_NAME}=${sessionId}`
        }
      });
      
      const extractedId = getSessionFromCookie(request);
      expect(extractedId).toBe(sessionId);
    });

    it('should extract session ID from multiple cookies', () => {
      const sessionId = 'test-session-id-1234567890abcdef';
      const request = new Request('https://example.com', {
        headers: {
          'Cookie': `other_cookie=value1; ${COOKIE_NAME}=${sessionId}; another_cookie=value2`
        }
      });
      
      const extractedId = getSessionFromCookie(request);
      expect(extractedId).toBe(sessionId);
    });

    it('should return null when session cookie is not present', () => {
      const request = new Request('https://example.com', {
        headers: {
          'Cookie': 'other_cookie=value1; another_cookie=value2'
        }
      });
      
      const extractedId = getSessionFromCookie(request);
      expect(extractedId).toBeNull();
    });

    it('should return null when Cookie header is missing', () => {
      const request = new Request('https://example.com');
      
      const extractedId = getSessionFromCookie(request);
      expect(extractedId).toBeNull();
    });

    it('should handle cookies with spaces', () => {
      const sessionId = 'test-session-id-1234567890abcdef';
      const request = new Request('https://example.com', {
        headers: {
          'Cookie': ` ${COOKIE_NAME}=${sessionId} ; other=value `
        }
      });
      
      const extractedId = getSessionFromCookie(request);
      expect(extractedId).toBe(sessionId);
    });
  });

  describe('clearSessionCookie', () => {
    it('should return headers to delete the session cookie', () => {
      const headers = clearSessionCookie();
      const cookieHeader = headers.get('Set-Cookie');
      
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain(`${COOKIE_NAME}=`);
      expect(cookieHeader).toContain('Max-Age=0');
      expect(cookieHeader).toContain('Path=/');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('SameSite=Strict');
    });
  });

  describe('constants', () => {
    it('should have correct cookie name', () => {
      expect(COOKIE_NAME).toBe('pb_session');
    });

    it('should have correct max age (1 day in seconds)', () => {
      expect(MAX_AGE).toBe(1 * 24 * 60 * 60);
    });
  });

  describe('performance', () => {
    it('should execute cookie operations in under 50ms', async () => {
      const start = performance.now();
      const env = { ENVIRONMENT: 'production' } as any;
      
      // Perform multiple operations
      const sessionId = 'perf-test-session-id-1234567890';
      const headers = setSessionCookie(sessionId, env);
      
      const request = new Request('https://example.com', {
        headers: {
          'Cookie': `${COOKIE_NAME}=${sessionId}; other=value`
        }
      });
      
      getSessionFromCookie(request);
      clearSessionCookie();
      
      const end = performance.now();
      expect(end - start).toBeLessThan(50);
    });
  });
});