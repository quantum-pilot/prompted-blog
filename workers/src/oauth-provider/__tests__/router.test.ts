// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import router from '../router';
import { RequestContext } from '../../utils/request-context';
import * as handlers from '../handlers';

// Mock handlers module
vi.mock('../handlers', () => ({
  ensureClientRegistered: vi.fn(),
  completeOAuthAuthorization: vi.fn()
}));

// Mock CORS utilities
vi.mock('../cors', () => ({
  handleCorsOptions: vi.fn(),
  errorResponse: vi.fn(),
  getCorsHeaders: vi.fn(() => ({ 'Access-Control-Allow-Origin': '*' }))
}));

// Mock RequestContext
vi.mock('../../utils/request-context', () => ({
  RequestContext: {
    create: vi.fn()
  }
}));

describe('OAuth Provider Router', () => {
  const mockEnv = {
    CLIENT_ID: 'test-client-id',
    REDIRECT_URI: 'https://test.example.com/auth/callback',
    SESSION_ENCRYPTION_KEY: 'test-key',
    OAUTH_SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
    OAUTH_PROVIDER: {
      parseAuthRequest: vi.fn(),
      lookupClient: vi.fn()
    }
  };

  const ctx = {};

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock context
    vi.mocked(RequestContext.create).mockResolvedValue({
      correlationId: 'test-correlation-id',
      log: vi.fn()
    });
  });

  it('should route /auth/start to OAuth authorize endpoint', async () => {
    const request = new Request('https://example.com/auth/start');
    const response = await router.fetch(request, mockEnv, ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/authorize');
    expect(response.headers.get('Location')).toContain('client_id=test-client-id');
  });

  it('should route /auth/callback to success response', async () => {
    const request = new Request('https://example.com/auth/callback?code=test&state=test');
    const response = await router.fetch(request, mockEnv, ctx);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.message).toBe('OAuth authorization completed');
  });

  it('should handle CORS preflight requests', async () => {
    const { handleCorsOptions } = await import('../cors');
    const mockResponse = new Response(null, { status: 204 });
    vi.mocked(handleCorsOptions).mockReturnValue(mockResponse);

    const request = new Request('https://example.com/auth/start', { method: 'OPTIONS' });
    const response = await router.fetch(request, mockEnv, ctx);

    expect(handleCorsOptions).toHaveBeenCalled();
    expect(response).toBe(mockResponse);
  });

  it('should return 404 for unknown routes', async () => {
    const { errorResponse } = await import('../cors');
    const mockResponse = new Response('not found', { status: 404 });
    vi.mocked(errorResponse).mockReturnValue(mockResponse);

    const request = new Request('https://example.com/unknown');
    const response = await router.fetch(request, mockEnv, ctx);

    expect(errorResponse).toHaveBeenCalledWith('not_found', 'Route not found', 404, null, expect.any(Object));
    expect(response).toBe(mockResponse);
  });

  it('should complete within latency budget', async () => {
    const request = new Request('https://example.com/auth/start');

    const startTime = Date.now();
    await router.fetch(request, mockEnv, ctx);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(50);
  });

  it('should handle /authorize endpoint', async () => {
    const mockOAuthReqInfo = {
      clientId: 'test-client-id',
      scope: 'openid email profile',
      responseType: 'code'
    };
    
    vi.mocked(mockEnv.OAUTH_PROVIDER.parseAuthRequest).mockResolvedValue(mockOAuthReqInfo);
    vi.mocked(handlers.completeOAuthAuthorization).mockResolvedValue('https://test.example.com/auth/callback?code=abc');

    const request = new Request('https://example.com/authorize?client_id=test-client-id');
    const response = await router.fetch(request, mockEnv, ctx);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://test.example.com/auth/callback?code=abc');
  });

  it('should handle errors gracefully', async () => {
    const { errorResponse } = await import('../cors');
    const mockResponse = new Response('error', { status: 500 });
    vi.mocked(errorResponse).mockReturnValue(mockResponse);
    vi.mocked(handlers.ensureClientRegistered).mockRejectedValueOnce(new Error('Test error'));

    const request = new Request('https://example.com/auth/start');
    const response = await router.fetch(request, mockEnv, ctx);

    expect(errorResponse).toHaveBeenCalledWith(
      'internal_error',
      'An unexpected error occurred',
      500,
      null,
      expect.any(Object)
    );
    expect(response).toBe(mockResponse);
  });

  it('should add CORS headers to /auth/callback response', async () => {
    const request = new Request('https://example.com/auth/callback', {
      headers: { 'Origin': 'https://client.example.com' }
    });
    const response = await router.fetch(request, mockEnv, ctx);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('X-Correlation-ID')).toBe('test-correlation-id');
  });

  it('should ensure client is registered before routing', async () => {
    const request = new Request('https://example.com/auth/start');
    await router.fetch(request, mockEnv, ctx);

    expect(handlers.ensureClientRegistered).toHaveBeenCalledWith(mockEnv);
  });

  it('should log audit events for route not found', async () => {
    const mockContext = {
      correlationId: 'test-correlation-id',
      log: vi.fn()
    };
    vi.mocked(RequestContext.create).mockResolvedValueOnce(mockContext);

    const { errorResponse } = await import('../cors');
    vi.mocked(errorResponse).mockReturnValueOnce(new Response('not found', { status: 404 }));

    const request = new Request('https://example.com/unknown');
    await router.fetch(request, mockEnv, ctx);

    expect(mockContext.log).toHaveBeenCalledWith(
      'ROUTE_NOT_FOUND',
      'failure',
      expect.objectContaining({
        path: '/unknown',
        method: 'GET',
        origin: 'none',
        reason: 'Unknown route accessed'
      })
    );
  });

  it('should pass context through to handlers correctly', async () => {
    const mockOAuthReqInfo = {
      clientId: 'test-client-id',
      scope: 'openid email profile',
      responseType: 'code'
    };
    
    const mockContext = {
      correlationId: 'test-correlation-id',
      log: vi.fn()
    };
    vi.mocked(RequestContext.create).mockResolvedValueOnce(mockContext);
    vi.mocked(mockEnv.OAUTH_PROVIDER.parseAuthRequest).mockResolvedValue(mockOAuthReqInfo);
    vi.mocked(handlers.completeOAuthAuthorization).mockResolvedValue('https://test.example.com/auth/callback?code=abc');

    const request = new Request('https://example.com/authorize?client_id=test-client-id');
    await router.fetch(request, mockEnv, ctx);

    expect(mockContext.log).toHaveBeenCalledWith(
      'AUTH_FLOW_INITIATED',
      'success',
      expect.objectContaining({
        clientId: 'test-client-id',
        scope: 'openid email profile',
        responseType: 'code'
      })
    );
  });
});