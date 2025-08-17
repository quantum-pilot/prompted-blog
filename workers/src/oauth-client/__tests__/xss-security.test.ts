// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../index';
import type { Env } from '../types';

describe('Advanced XSS Security Tests', () => {
  let env: Env;

  beforeEach(() => {
    const kvStore = new Map<string, string>();
    
    env = {
      ALLOWED_ORIGINS: 'http://localhost:3000',
      GOOGLE_CLIENT_ID: 'test-google-client',
      CLIENT_ID: 'test-client',
      REDIRECT_URI: 'http://localhost:3000/callback',
      FRONTEND_URL: 'http://localhost:3000',
      SESSION_ENCRYPTION_KEY: 'test-encryption-key-32-bytes-long-for-testing!',
      SESSION_ENCRYPTION_SALT: 'test-salt-for-xss-security',
      OAUTH_SESSIONS: {
        put: async (key: string, value: string) => {
          kvStore.set(key, value);
        },
        get: async (key: string) => kvStore.get(key) || null,
        delete: async (key: string) => {
          kvStore.delete(key);
        }
      } as any,
      OAUTH_KV: {} as any
    };
  });

  describe('SVG-based XSS Vectors', () => {
    const svgVectors = [
      '<svg onload=alert(1)>',
      '<svg/onload=alert(1)>',
      '<svg><script>alert(1)</script></svg>',
      '<svg><animate onbegin=alert(1) attributeName=x dur=1s>',
      '<svg><set onbegin=alert(1) attributename=x to=1>',
      '<svg><animatetransform onbegin=alert(1)>',
      '<svg><foreignObject><iframe onload=alert(1)></iframe></foreignObject></svg>'
    ];

    svgVectors.forEach(vector => {
      it(`should reject SVG XSS vector: ${vector.substring(0, 30)}...`, async () => {
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        expect(response.status).toBe(400);
        const data = await response.json() as any;
        expect(data.error).toBe('invalid_request');
      });
    });
  });

  describe('Image-based XSS Vectors', () => {
    const imgVectors = [
      '<img src=x onerror=alert(1)>',
      '<img src=x:alert(1) onerror=eval(src)>',
      '<img src="x" onerror="alert(1)">',
      '<img/src/onerror=alert(1)>',
      '<image src=x onerror=alert(1)>',
      '<img src=javascript:alert(1)>',
      '<img src="data:text/html,<script>alert(1)</script>">'
    ];

    imgVectors.forEach(vector => {
      it(`should reject IMG XSS vector: ${vector.substring(0, 30)}...`, async () => {
        const request = new Request(`http://localhost/oauth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '192.168.1.100'
          },
          body: JSON.stringify({
            code: 'test-code',
            state: vector,
            code_verifier: 'test-verifier'
          })
        });
        
        const response = await worker.fetch(request, env, {});
        expect(response.status).toBe(400);
      });
    });
  });

  describe('JavaScript Protocol XSS', () => {
    const jsProtocolVectors = [
      'javascript:alert(1)',
      'javascript:alert`1`',
      'javascript://comment%0Aalert(1)',
      'javascript:/*comment*/alert(1)',
      '\x00javascript:alert(1)',
      'java\nscript:alert(1)',
      'java\rscript:alert(1)',
      'java\tscript:alert(1)'
    ];

    jsProtocolVectors.forEach(vector => {
      it(`should reject JavaScript protocol: ${vector.substring(0, 30)}...`, async () => {
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        expect(response.status).toBe(400);
      });
    });
  });

  describe('Data URI XSS Vectors', () => {
    const dataUriVectors = [
      'data:text/html,<script>alert(1)</script>',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'data:application/javascript,alert(1)',
      'data:application/javascript;base64,YWxlcnQoMSk=',
      'data:text/html,<svg onload=alert(1)>',
      'data:image/svg+xml,<svg onload=alert(1)>'
    ];

    dataUriVectors.forEach(vector => {
      it(`should reject data URI XSS: ${vector.substring(0, 40)}...`, async () => {
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        expect(response.status).toBe(400);
      });
    });
  });

  describe('DOM-based XSS Scenarios', () => {
    const domXssVectors = [
      '"><script>alert(1)</script>',
      '\'><script>alert(1)</script>',
      '`;alert(1);//',
      '${alert(1)}',
      '{{constructor.constructor(\'alert(1)\')()}}',
      '<div onclick="alert(1)">',
      '<div onmouseover="alert(1)">',
      '<body onload="alert(1)">',
      '<iframe srcdoc="<script>alert(1)</script>">'
    ];

    domXssVectors.forEach(vector => {
      it(`should reject DOM XSS vector: ${vector.substring(0, 30)}...`, async () => {
        const request = new Request(`http://localhost/oauth/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '192.168.1.100'
          },
          body: JSON.stringify({
            code: vector,
            state: 'valid-state',
            code_verifier: 'test-verifier'
          })
        });
        
        const response = await worker.fetch(request, env, {});
        // Should fail due to missing PKCE or invalid format
        expect(response.status).not.toBe(200);
      });
    });
  });

  describe('Mutation XSS Patterns', () => {
    const mutationVectors = [
      '<form><math><mtext></form><form><mglyph><style><img src=x onerror=alert(1)>',
      '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)-->',
      '<form><math><mtext></form><form><mglyph><svg><mtext><style><path id="</style><img onerror=alert(1) src>">',
      '<x/><title>&lt;/title&gt;&lt;img src=x onerror=alert(1)&gt;'
    ];

    mutationVectors.forEach(vector => {
      it(`should reject mutation XSS: ${vector.substring(0, 40)}...`, async () => {
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        expect(response.status).toBe(400);
      });
    });
  });

  describe('Event Handler XSS', () => {
    const eventHandlers = [
      'onload=alert(1)',
      'onerror=alert(1)',
      'onclick=alert(1)',
      'onmouseover=alert(1)',
      'onfocus=alert(1)',
      'onblur=alert(1)',
      'onchange=alert(1)',
      'onsubmit=alert(1)',
      'onkeypress=alert(1)',
      'onkeydown=alert(1)',
      'onkeyup=alert(1)'
    ];

    eventHandlers.forEach(handler => {
      it(`should reject event handler: ${handler}`, async () => {
        const vector = `<div ${handler}>test</div>`;
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        expect(response.status).toBe(400);
      });
    });
  });

  describe('Encoding Bypass Attempts', () => {
    const encodingVectors = [
      '%3Cscript%3Ealert(1)%3C/script%3E', // URL encoded
      '\\x3cscript\\x3ealert(1)\\x3c/script\\x3e', // Hex encoded
      '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e', // Unicode encoded
      '&lt;script&gt;alert(1)&lt;/script&gt;', // HTML entities
      '&#60;script&#62;alert(1)&#60;/script&#62;', // Decimal entities
      '&#x3c;script&#x3e;alert(1)&#x3c;/script&#x3e;' // Hex entities
    ];

    encodingVectors.forEach(vector => {
      it(`should reject encoded XSS: ${vector.substring(0, 30)}...`, async () => {
        const request = new Request(`http://localhost/oauth/authorize?code_challenge=test&state=${vector}&provider=google`, {
          headers: {
            'CF-Connecting-IP': '192.168.1.100'
          }
        });
        const response = await worker.fetch(request, env, {});
        
        // Should reject or handle safely
        if (response.status === 200) {
          const data = await response.json() as any;
          // If accepted, ensure it's properly encoded in response
          expect(data.authorizationUrl).not.toContain('<script>');
          expect(data.authorizationUrl).not.toContain('alert(');
        }
      });
    });
  });

  describe('Content Type Confusion', () => {
    it('should enforce correct content-type on responses', async () => {
      const request = new Request('http://localhost/oauth/session', {
        headers: {
          'Authorization': 'Bearer invalid',
          'Accept': 'text/html', // Try to get HTML response
          'CF-Connecting-IP': '192.168.1.100'
        }
      });
      
      const response = await worker.fetch(request, env, {});
      
      // Should always return JSON content-type
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should not reflect user input in error messages', async () => {
      const xssPayload = '<script>alert(1)</script>';
      const request = new Request(`http://localhost/oauth/authorize?code_challenge=${xssPayload}&state=test&provider=google`, {
        headers: {
          'CF-Connecting-IP': '192.168.1.100'
        }
      });
      
      const response = await worker.fetch(request, env, {});
      const text = await response.text();
      
      // Response should not contain the XSS payload
      expect(text).not.toContain(xssPayload);
      expect(text).not.toContain('<script>');
    });
  });

  describe('Header Injection Prevention', () => {
    it('should prevent header injection via state parameter', async () => {
      const headerInjectionVectors = [
        'test\r\nX-Injected: true',
        'test\nSet-Cookie: admin=true',
        'test\r\n\r\n<script>alert(1)</script>',
        'test%0d%0aLocation: http://evil.com'
      ];

      for (const vector of headerInjectionVectors) {
        // Test via query parameter (headers can't contain newlines)
        const request = new Request(
          `http://localhost/oauth/authorize?code_challenge=test&state=${encodeURIComponent(vector)}&provider=google`
        );
        
        const response = await worker.fetch(request, env, {});
        
        // Should reject due to invalid state format
        expect(response.status).toBe(400);
        
        // Should not have injected headers
        expect(response.headers.get('X-Injected')).toBeNull();
        expect(response.headers.get('Set-Cookie')).toBeNull();
      }
    });
  });
});