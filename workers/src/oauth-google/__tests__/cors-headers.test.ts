// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { getCorsHeaders } from '../cors';

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
