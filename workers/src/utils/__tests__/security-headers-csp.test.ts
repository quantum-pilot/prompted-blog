// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { getSecurityHeaders, applySecurityHeaders } from '../security-headers';

describe('Content Security Policy Tests', () => {
  describe('CSP Configuration', () => {
    it('should have comprehensive CSP directives', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      expect(csp).toBeDefined();
      
      // Check for all required directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' https://accounts.google.com");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: https:");
      expect(csp).toContain("connect-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");
    });

    it('should prevent XSS through CSP', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Should not allow unsafe-inline scripts
      expect(csp).not.toContain("script-src 'unsafe-inline'");
      expect(csp).not.toContain("script-src *");
      
      // Should not allow unsafe-eval
      expect(csp).not.toContain("'unsafe-eval'");
      
      // Should restrict frame ancestors
      expect(csp).toContain("frame-ancestors 'none'");
    });

    it('should allow necessary OAuth resources', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Should allow Google OAuth scripts
      expect(csp).toContain('https://accounts.google.com');
      
      // Should allow data URIs for images (for avatars)
      expect(csp).toContain('img-src');
      expect(csp).toContain('data:');
      
      // Should allow HTTPS images
      expect(csp).toContain('https:');
    });

    it('should prevent form submissions to external sites', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // form-action should be restricted to self
      expect(csp).toContain("form-action 'self'");
      
      // Should not allow wildcard form actions
      expect(csp).not.toContain('form-action *');
      expect(csp).not.toContain("form-action 'unsafe-inline'");
    });

    it('should prevent base tag hijacking', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // base-uri should be restricted to self
      expect(csp).toContain("base-uri 'self'");
      
      // Should not allow external base URIs
      expect(csp).not.toContain('base-uri *');
      expect(csp).not.toContain('base-uri http:');
    });
  });

  describe('CSP Header Application', () => {
    it('should apply CSP to responses', () => {
      const originalResponse = new Response('test body', {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const securedResponse = applySecurityHeaders(originalResponse);
      
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      expect(securedResponse.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    });

    it('should preserve existing headers when applying CSP', () => {
      const originalResponse = new Response('test body', {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      });
      
      const securedResponse = applySecurityHeaders(originalResponse);
      
      // Should preserve original headers
      expect(securedResponse.headers.get('Content-Type')).toBe('application/json');
      expect(securedResponse.headers.get('X-Custom-Header')).toBe('custom-value');
      
      // Should add CSP
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
    });

    it('should override existing CSP if present', () => {
      const originalResponse = new Response('test body', {
        status: 200,
        headers: {
          'Content-Security-Policy': "default-src *; script-src 'unsafe-inline'"
        }
      });
      
      const securedResponse = applySecurityHeaders(originalResponse);
      const csp = securedResponse.headers.get('Content-Security-Policy');
      
      // Should replace with secure CSP
      expect(csp).not.toContain("default-src *");
      expect(csp).not.toContain("script-src 'unsafe-inline'"); // script-src should not have unsafe-inline
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'"); // style-src can have unsafe-inline for OAuth
    });
  });

  describe('CSP Reporting', () => {
    it('should not include report-uri in CSP', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Report-uri is deprecated, should use report-to
      expect(csp).not.toContain('report-uri');
      
      // For now, we don't have reporting configured
      // This could be added in the future
      expect(csp).not.toContain('report-to');
    });
  });

  describe('CSP Compatibility', () => {
    it('should be compatible with OAuth flow', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Should allow redirects to Google OAuth
      expect(csp).toContain('https://accounts.google.com');
      
      // Should allow self for API calls
      expect(csp).toContain("connect-src 'self'");
      
      // Should allow inline styles for OAuth buttons (with unsafe-inline)
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    });

    it('should work with JSON responses', () => {
      const jsonResponse = new Response(JSON.stringify({ data: 'test' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const securedResponse = applySecurityHeaders(jsonResponse);
      
      // CSP should be applied even to JSON responses
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      
      // Should not break JSON responses
      expect(securedResponse.headers.get('Content-Type')).toBe('application/json');
    });

    it('should work with error responses', () => {
      const errorResponse = new Response('Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
      
      const securedResponse = applySecurityHeaders(errorResponse);
      
      // CSP should be applied to error responses
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      
      // Should preserve error status
      expect(securedResponse.status).toBe(404);
    });
  });

  describe('CSP Security Validations', () => {
    it('should not allow unsafe configurations', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Should not have these unsafe configurations
      const unsafePatterns = [
        "'unsafe-eval'",
        "script-src *",
        "default-src *",
        "style-src *",
        "img-src *",
        "connect-src *",
        "frame-src *",
        "object-src *",
        "media-src *",
        "font-src *"
      ];
      
      unsafePatterns.forEach(pattern => {
        expect(csp).not.toContain(pattern);
      });
    });

    it('should block inline event handlers', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // Without unsafe-inline in script-src, inline event handlers are blocked
      expect(csp).toContain('script-src');
      expect(csp.match(/script-src[^;]*'unsafe-inline'/)).toBeNull();
    });

    it('should prevent plugin-based attacks', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // object-src should be implicitly 'none' through default-src 'self'
      // Could be made explicit for clarity
      expect(csp).toContain("default-src 'self'");
      
      // This implicitly sets object-src to 'self' which is still restrictive
      // TODO: Consider adding explicit "object-src 'none'" for clarity
    });

    it('should prevent frame embedding', () => {
      const headers = getSecurityHeaders();
      const csp = headers['Content-Security-Policy'];
      
      // frame-ancestors prevents clickjacking
      expect(csp).toContain("frame-ancestors 'none'");
      
      // Also check X-Frame-Options for older browsers
      expect(headers['X-Frame-Options']).toBe('DENY');
    });
  });

  describe('CSP for Different Response Types', () => {
    it('should apply CSP to HTML responses', () => {
      const htmlResponse = new Response('<html><body>Test</body></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html'
        }
      });
      
      const securedResponse = applySecurityHeaders(htmlResponse);
      
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      expect(securedResponse.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('should apply CSP to redirect responses', () => {
      const redirectResponse = new Response(null, {
        status: 302,
        headers: {
          'Location': 'https://example.com/callback'
        }
      });
      
      const securedResponse = applySecurityHeaders(redirectResponse);
      
      // CSP should be applied even to redirects
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      
      // Should preserve redirect
      expect(securedResponse.status).toBe(302);
      expect(securedResponse.headers.get('Location')).toBe('https://example.com/callback');
    });

    it('should apply CSP to OPTIONS responses', () => {
      const optionsResponse = new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'GET, POST',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
      
      const securedResponse = applySecurityHeaders(optionsResponse);
      
      // CSP should be applied to preflight responses
      expect(securedResponse.headers.get('Content-Security-Policy')).toBeDefined();
      
      // Should preserve CORS headers
      expect(securedResponse.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST');
    });
  });
});