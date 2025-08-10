// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { 
  googleOAuthConfig, 
  getProviderConfig, 
  createOAuthConfig,
  type OAuthEnvironment 
} from '../config';

describe('Google OAuth Configuration', () => {
  it('should export Google OAuth configuration object', () => {
    expect(googleOAuthConfig).toBeDefined();
    expect(typeof googleOAuthConfig).toBe('object');
  });

  it('should have correct configuration properties', () => {
    expect(googleOAuthConfig.authorizationEndpoint).toBe('https://accounts.google.com/o/oauth2/auth');
    expect(googleOAuthConfig.tokenEndpoint).toBe('https://oauth2.googleapis.com/token');
    expect(googleOAuthConfig.userinfoEndpoint).toBe('https://www.googleapis.com/oauth2/v2/userinfo');
    expect(googleOAuthConfig.scopes).toEqual(['openid', 'email', 'profile']);
    expect(googleOAuthConfig.providerName).toBe('google');
    expect(googleOAuthConfig.pkce).toBe(true);
    expect(googleOAuthConfig.additionalParams).toEqual({
      access_type: 'online',
      prompt: 'select_account'
    });
  });

  it('should handle latency requirement - config access under 50ms', async () => {
    const start = performance.now();
    
    // Access all configuration properties
    const config = googleOAuthConfig;
    const authEndpoint = config.authorizationEndpoint;
    const tokenEndpoint = config.tokenEndpoint;
    const userinfoEndpoint = config.userinfoEndpoint;
    const scopes = config.scopes;
    const provider = config.providerName;
    const pkce = config.pkce;
    const params = config.additionalParams;
    
    const end = performance.now();
    const duration = end - start;
    
    expect(duration).toBeLessThan(50);
    expect(authEndpoint).toBeDefined();
    expect(tokenEndpoint).toBeDefined();
    expect(userinfoEndpoint).toBeDefined();
    expect(scopes).toBeDefined();
    expect(provider).toBeDefined();
    expect(pkce).toBeDefined();
    expect(params).toBeDefined();
  });

  describe('getProviderConfig', () => {
    it('should return Google config for "google" provider', () => {
      const config = getProviderConfig('google');
      expect(config).toEqual(googleOAuthConfig);
    });

    it('should be case insensitive', () => {
      const config = getProviderConfig('GOOGLE');
      expect(config).toEqual(googleOAuthConfig);
    });

    it('should throw error for unsupported provider', () => {
      expect(() => getProviderConfig('facebook')).toThrow('Unsupported OAuth provider: facebook');
    });
  });

  describe('createOAuthConfig', () => {
    const mockEnv: OAuthEnvironment = {
      CLIENT_ID: 'test-client-id',
      REDIRECT_URI: 'https://example.com/callback'
    };

    it('should combine provider config with environment values', () => {
      const config = createOAuthConfig(mockEnv);
      
      expect(config.CLIENT_ID).toBe('test-client-id');
      expect(config.REDIRECT_URI).toBe('https://example.com/callback');
      expect(config.providerName).toBe('google');
      expect(config.authorizationEndpoint).toBe('https://accounts.google.com/o/oauth2/auth');
    });

    it('should support specifying provider name', () => {
      const config = createOAuthConfig(mockEnv, 'google');
      expect(config.providerName).toBe('google');
    });
  });
});