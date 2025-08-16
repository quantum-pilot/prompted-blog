// @agent: cloudflare-backend
/**
 * Token exchange and validation logic for OAuth
 */

import * as oauth from 'oauth4webapi';
import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

export interface TokenExchangeParams {
  code: string;
  codeVerifier: string;
  clientId: string;
  redirectUri: string;
  tokenEndpoint: string;
}

export interface TokenValidationResult {
  tokens: oauth.TokenEndpointResponse;
  claims: oauth.IDToken;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  params: TokenExchangeParams,
  as: oauth.AuthorizationServer,
  context: RequestContext
): Promise<oauth.TokenEndpointResponse> {
  // Create OAuth client for PKCE flow (public client)
  const client: oauth.Client = {
    client_id: params.clientId,
    token_endpoint_auth_method: 'none' // Public client for PKCE
  };

  // Create parameters for token exchange
  const requestParams = new URLSearchParams();
  requestParams.set('grant_type', 'authorization_code');
  requestParams.set('code', params.code);
  requestParams.set('redirect_uri', params.redirectUri);
  requestParams.set('client_id', params.clientId);
  requestParams.set('code_verifier', params.codeVerifier);

  // Exchange code for tokens with proper validation
  const tokenResponse = await fetch(params.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: requestParams,
  });

  // Process the token response with oauth4webapi for signature validation
  try {
    // oauth4webapi validates JWT signature against provider's JWKS
    const tokens = await oauth.processAuthorizationCodeResponse(
      as,
      client,
      tokenResponse
    );
    
    return tokens;
  } catch (error) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', { 
      reason: 'Token response validation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
}

/**
 * Validate ID token claims for Google OAuth
 */
export function validateGoogleIdToken(
  tokens: oauth.TokenEndpointResponse,
  clientId: string,
  context: RequestContext
): oauth.IDToken {
  // Get validated ID token claims (oauth4webapi performed signature verification)
  const claims = oauth.getValidatedIdTokenClaims(tokens);
  
  if (!claims) {
    throw new Error('No ID token claims available');
  }
  
  // Additional validation for Google-specific requirements
  const issuer = claims.iss;
  if (issuer !== 'https://accounts.google.com' && issuer !== 'accounts.google.com') {
    throw new Error('Invalid issuer');
  }
  
  // Verify audience matches our client ID
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) {
    throw new Error('Invalid audience');
  }
  
  // Check token expiration (oauth4webapi already validates this, but double-check)
  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    throw new Error('Token expired');
  }
  
  // Check issued at time (iat) is not in the future
  if (claims.iat && claims.iat > now + 60) { // Allow 60 seconds clock skew
    throw new Error('Token issued in the future');
  }

  return claims;
}