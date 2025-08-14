/**
 * OAuth Provider Configurations
 */

import { OAuthProvider, ProviderConfig } from './oauth-types';

/**
 * Get provider-specific configuration
 */
export function getProviderConfig(provider: OAuthProvider): ProviderConfig {
  switch (provider) {
    case OAuthProvider.Google:
      return {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: ['openid', 'email', 'profile'],
        additionalParams: {
          'access_type': 'online',
          'prompt': 'select_account'
        }
      };
    
    case OAuthProvider.GitHub:
      // Future implementation
      throw new Error(`Provider ${provider} not yet supported`);
    
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}