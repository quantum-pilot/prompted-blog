/**
 * OAuth Provider Configurations
 */

import { OAuthProvider, ProviderConfig } from './oauth-types';
import { OAUTH_SCOPES } from '@app/shared';

/**
 * Get provider-specific configuration
 * Returns a partial ProviderConfig with only the fields used by the frontend
 */
export function getProviderConfig(provider: OAuthProvider): Pick<ProviderConfig, 'authorizationEndpoint' | 'scopes' | 'additionalParams'> {
  switch (provider) {
    case OAuthProvider.Google:
      return {
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        scopes: OAUTH_SCOPES.GOOGLE,
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