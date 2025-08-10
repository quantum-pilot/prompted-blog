// @agent: cloudflare-backend
/**
 * Google OAuth provider configuration module
 * Provides standardized configuration for Google OAuth 2.0 integration
 * using @cloudflare/workers-oauth-provider library
 */

export interface OAuthProviderConfig {
  providerName: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scopes: string[];
  pkce: boolean;
  additionalParams?: Record<string, string>;
}

/**
 * Google OAuth 2.0 provider configuration
 * Configured for PKCE flow with standard OpenID Connect scopes
 */
export const googleOAuthConfig: OAuthProviderConfig = {
  providerName: 'google',
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  userinfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo',
  scopes: ['openid', 'email', 'profile'],
  pkce: true,
  additionalParams: {
    access_type: 'online',
    prompt: 'select_account'
  }
};

/**
 * Helper function to get provider configuration by name
 * Currently supports 'google' provider only
 */
export function getProviderConfig(providerName: string): OAuthProviderConfig {
  switch (providerName.toLowerCase()) {
    case 'google':
      return googleOAuthConfig;
    default:
      throw new Error(`Unsupported OAuth provider: ${providerName}`);
  }
}

/**
 * Environment interface for OAuth configuration
 * Maps to Cloudflare environment variables
 */
export interface OAuthEnvironment {
  CLIENT_ID: string;
  REDIRECT_URI: string;
}

/**
 * Creates OAuth configuration object compatible with @cloudflare/workers-oauth-provider
 * Combines provider config with environment-specific values
 */
export function createOAuthConfig(
  env: OAuthEnvironment,
  providerName: string = 'google'
): OAuthProviderConfig & OAuthEnvironment {
  const providerConfig = getProviderConfig(providerName);
  
  return {
    ...providerConfig,
    CLIENT_ID: env.CLIENT_ID,
    REDIRECT_URI: env.REDIRECT_URI
  };
}