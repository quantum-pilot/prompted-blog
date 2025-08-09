// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { getCorsHeaders } from '../cors';

describe('CORS Security Validation', () => {
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

  it('should reject origin variations with wrong case', () => {
    const variations = [
      'https://PROMPTEDBLOG.com',
      'HTTPS://promptedblog.com',
      'https://PromptedBlog.com',
      'HTTP://localhost:8000',
      'http://LOCALHOST:8000'
    ];

    variations.forEach(origin => {
      const headers = getCorsHeaders(origin);
      expect(headers).toEqual({});
    });
  });

  it('should reject subdomain injections', () => {
    const maliciousSubdomains = [
      'https://www.promptedblog.com',
      'https://api.promptedblog.com',
      'https://subdomain.promptedblog.com',
      'https://promptedblog.com.evil.com',
      'https://evil.promptedblog.com',
      'http://subdomain.localhost:8000'
    ];

    maliciousSubdomains.forEach(origin => {
      const headers = getCorsHeaders(origin);
      expect(headers).toEqual({});
    });
  });

  it('should reject port variations', () => {
    const portVariations = [
      'https://promptedblog.com:443',
      'https://promptedblog.com:8080',
      'https://promptedblog.com:3000',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:8001',
      'http://127.0.0.1:8000',
      'https://localhost:8000'
    ];

    portVariations.forEach(origin => {
      const headers = getCorsHeaders(origin);
      expect(headers).toEqual({});
    });
  });

  it('should only accept exact whitelisted origins', () => {
    const validOrigins = ['https://promptedblog.com', 'http://localhost:8000'];
    const invalidOrigins = [
      'https://promptedblog.org',
      'http://promptedblog.com',
      'https://localhost:8000',
      'http://127.0.0.1:8000'
    ];

    validOrigins.forEach(origin => {
      const headers = getCorsHeaders(origin);
      expect(headers['Access-Control-Allow-Origin']).toBe(origin);
    });

    invalidOrigins.forEach(origin => {
      const headers = getCorsHeaders(origin);
      expect(headers).toEqual({});
    });
  });
});