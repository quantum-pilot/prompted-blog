// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from 'vitest';
import worker from '../index';
import { createMockEnv } from './test-helpers';

describe('OAuth Provider Integration', () => {
  let env: any;

  beforeEach(() => {
    env = createMockEnv();
    // Mock OAUTH_PROVIDER methods for integration testing
    env.OAUTH_PROVIDER = {
      parseAuthRequest: vi.fn().mockResolvedValue({
        clientId: 'test-client-id',
        scope: 'openid email profile',
        responseType: 'code',
        redirectUri: 'https://example.com/oauth/callback'
      }),
      lookupClient: vi.fn().mockResolvedValue({
        client_id: 'test-client-id',
        client_name: 'Test Client'
      }),
      completeAuthorization: vi.fn().mockResolvedValue({
        redirectTo: 'https://example.com/oauth/callback?code=test-code&state=test-state'
      }),
      createClient: vi.fn().mockResolvedValue(true)
    };
  });

  it('should export OAuthProvider instance with proper configuration', async () => {
    // Verify worker exports default with fetch method
    expect(worker).toBeDefined();
    expect(typeof worker.fetch).toBe('function');
  });

  it('should handle /authorize endpoint with OAuthProvider methods', async () => {
    const request = new Request('https://example.com/authorize?client_id=test&response_type=code');
    const response = await worker.fetch(request, env);
    
    // Should redirect after authorization
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('oauth/callback');
    
    // Verify OAuthProvider methods were called
    expect(env.OAUTH_PROVIDER.parseAuthRequest).toHaveBeenCalledWith(request);
    expect(env.OAUTH_PROVIDER.lookupClient).toHaveBeenCalledWith('test-client-id');
    expect(env.OAUTH_PROVIDER.completeAuthorization).toHaveBeenCalled();
  });

  it('should handle /auth/start endpoint and redirect to /authorize', async () => {
    const request = new Request('https://example.com/auth/start');
    const response = await worker.fetch(request, env);
    
    expect(response.status).toBe(302);
    const location = response.headers.get('Location');
    expect(location).toContain('/authorize');
    expect(location).toContain('client_id=test-client-id');
    expect(location).toContain('response_type=code');
    expect(location).toContain('scope=openid+email+profile');
  });

  it('should handle /auth/callback endpoint', async () => {
    const request = new Request('https://example.com/auth/callback?code=test&state=test');
    const response = await worker.fetch(request, env);
    
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.success).toBe(true);
    expect(data.message).toBe('OAuth authorization completed');
  });

  it('should handle API routes through apiHandler with proper auth', async () => {
    // API routes require authentication tokens from OAuthProvider
    const request = new Request('https://example.com/api/profile');
    
    // Without auth token, should return 401
    const response = await worker.fetch(request, env);
    
    expect(response.status).toBe(401);
    const data = await response.json() as any;
    expect(data.error).toBe('invalid_token');
    expect(data.error_description).toBe('Missing or invalid access token');
  });

  it('should respond in under 50ms for all main endpoints', async () => {
    const endpoints = ['/auth/start', '/auth/callback', '/api/profile'];
    
    for (const endpoint of endpoints) {
      const request = new Request(`https://example.com${endpoint}`);
      const start = performance.now();
      await worker.fetch(request, env);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    }
  });
});