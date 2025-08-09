// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { handleCorsOptions, jsonResponse, errorResponse } from '../cors';
import { measurePerformance, assertLatency } from './test-helpers';

// Helper to create OPTIONS request
const optionsReq = (origin?: string) => new Request('https://example.com/test', {
  method: 'OPTIONS',
  headers: origin ? { 'Origin': origin } : {}
});

// Helper to assert CORS headers
const assertCors = (res: Response, origin: string | null, hasCredentials = false) => {
  if (origin) {
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe(hasCredentials ? 'true' : null);
  } else {
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBeNull();
  }
};

describe('handleCorsOptions', () => {
  it('should handle OPTIONS preflight for allowed origin', () => {
    const response = handleCorsOptions(optionsReq('https://promptedblog.com'));
    expect(response.status).toBe(204);
    assertCors(response, 'https://promptedblog.com', true);
  });

  it('should not set CORS headers for non-whitelisted origin', () => {
    const response = handleCorsOptions(optionsReq('https://evil-site.com'));
    expect(response.status).toBe(204);
    assertCors(response, null);
  });

  it('should handle OPTIONS without origin header', () => {
    const response = handleCorsOptions(optionsReq());
    expect(response.status).toBe(204);
    assertCors(response, null);
  });

  it('should complete within 50ms', async () => {
    const { duration } = await measurePerformance(() =>
      handleCorsOptions(optionsReq('https://promptedblog.com'))
    );
    assertLatency(duration);
  });
});

describe('jsonResponse with CORS', () => {
  const testData = { success: true };

  it('should include CORS headers for allowed origin', () => {
    const response = jsonResponse(testData, 200, {}, 'https://promptedblog.com');
    assertCors(response, 'https://promptedblog.com', true);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should not include CORS headers for non-whitelisted origin', () => {
    const response = jsonResponse(testData, 200, {}, 'https://hacker.com');
    assertCors(response, null);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should work without origin parameter', () => {
    const response = jsonResponse(testData);
    assertCors(response, null);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('errorResponse with CORS', () => {
  const errorParams = ['invalid_request', 'Missing required parameter', 400] as const;

  it('should include CORS headers for allowed origin in error responses', () => {
    const response = errorResponse(...errorParams, 'http://localhost:8000');
    expect(response.status).toBe(400);
    assertCors(response, 'http://localhost:8000', true);
  });

  it('should not include CORS headers for non-whitelisted origin in error responses', () => {
    const response = errorResponse(...errorParams, 'https://attacker.com');
    expect(response.status).toBe(400);
    assertCors(response, null);
  });
});
