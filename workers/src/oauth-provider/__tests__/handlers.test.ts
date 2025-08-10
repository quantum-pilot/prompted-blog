// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureClientRegistered, completeOAuthAuthorization, createClientConfig } from '../handlers';

describe('OAuth Handlers', () => {
  const mockEnv = {
    CLIENT_ID: 'test-client-id',
    REDIRECT_URI: 'https://example.com/callback',
    SESSION_ENCRYPTION_KEY: 'test-key-32-characters-long-key',
    OAUTH_SESSIONS: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } as any,
    OAUTH_KV: {} as any,
    OAUTH_PROVIDER: {
      lookupClient: vi.fn(),
      createClient: vi.fn(),
      completeAuthorization: vi.fn()
    }
  };

  beforeEach(() => vi.clearAllMocks());

  describe('ensureClientRegistered', () => {
    it('should register client if it does not exist', async () => {
      mockEnv.OAUTH_PROVIDER.lookupClient.mockRejectedValue(new Error('Client not found'));
      await ensureClientRegistered(mockEnv);
      expect(mockEnv.OAUTH_PROVIDER.lookupClient).toHaveBeenCalledWith('test-client-id');
      expect(mockEnv.OAUTH_PROVIDER.createClient).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: 'test-client-id',
          redirect_uris: ['https://example.com/callback']
        })
      );
    });

    it('should not register client if it already exists', async () => {
      mockEnv.OAUTH_PROVIDER.lookupClient.mockResolvedValue({ client_id: 'test-client-id' });
      await ensureClientRegistered(mockEnv);
      expect(mockEnv.OAUTH_PROVIDER.lookupClient).toHaveBeenCalledWith('test-client-id');
      expect(mockEnv.OAUTH_PROVIDER.createClient).not.toHaveBeenCalled();
    });

    it('should complete within latency budget', async () => {
      mockEnv.OAUTH_PROVIDER.lookupClient.mockResolvedValue({ client_id: 'test-client-id' });
      const startTime = Date.now();
      await ensureClientRegistered(mockEnv);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('completeOAuthAuthorization', () => {
    it('should complete authorization and return redirect URL', async () => {
      const mockOAuthRequest = { clientId: 'test-client-id' };
      const mockRedirectUrl = 'https://example.com/callback?code=auth-code';
      mockEnv.OAUTH_PROVIDER.completeAuthorization.mockResolvedValue({
        redirectTo: mockRedirectUrl
      });
      const result = await completeOAuthAuthorization(mockOAuthRequest, mockEnv);
      expect(result).toBe(mockRedirectUrl);
      expect(mockEnv.OAUTH_PROVIDER.completeAuthorization).toHaveBeenCalledWith(
        expect.objectContaining({
          request: mockOAuthRequest,
          userId: expect.stringContaining('google-user-')
        })
      );
    });

    it('should complete within latency budget', async () => {
      const mockOAuthRequest = { clientId: 'test-client-id' };
      mockEnv.OAUTH_PROVIDER.completeAuthorization.mockResolvedValue({
        redirectTo: 'https://example.com/callback?code=auth-code'
      });
      const startTime = Date.now();
      await completeOAuthAuthorization(mockOAuthRequest, mockEnv);
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('createClientConfig', () => {
    it('should create proper client configuration', () => {
      const config = createClientConfig(mockEnv);
      expect(config).toEqual({
        client_id: 'test-client-id',
        redirect_uris: ['https://example.com/callback'],
        client_name: 'Google OAuth Client',
        scope: 'openid email profile',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none'
      });
    });
  });
});