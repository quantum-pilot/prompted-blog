// @agent: cloudflare-backend
/**
 * OAuth callback handler using oauth4webapi for PKCE flow
 */

import * as oauth from 'oauth4webapi';
import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

/**
 * Validates that a state parameter is safe to use as a KV key suffix.
 * States should be alphanumeric with hyphens and underscores, max 128 chars.
 */
function isValidStateParameter(state: string): boolean {
  // Allow alphanumeric, dash, underscore, max 128 chars
  // This prevents injection attacks and ensures safe KV key usage
  const statePattern = /^[A-Za-z0-9_-]{1,128}$/;
  return statePattern.test(state);
}

/**
 * Creates a sanitized JSON error response for OAuth errors.
 * Returns standard OAuth error codes with generic descriptions.
 */
function jsonResponse(
  error: { error: string; error_description: string },
  status: number,
  origin?: string,
  context?: RequestContext
): Response {
  return new Response(JSON.stringify(error), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export interface OAuthProvider {
  name: string;
  authorizationServer: URL;
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export function getGoogleProvider(env: Env): OAuthProvider {
  return {
    name: 'google',
    authorizationServer: new URL('https://accounts.google.com'),
    clientId: env.GOOGLE_CLIENT_ID || env.CLIENT_ID,
    redirectUri: env.REDIRECT_URI || `${env.FRONTEND_URL}/oauth/callback`,
    scopes: ['openid', 'email', 'profile']
  };
}

/**
 * Validates PKCE code verifier against stored challenge
 */
async function validatePKCE(verifier: string, challenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return base64 === challenge;
}

export async function handleOAuthCallback(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  // Read parameters from request body for POST requests or URL for GET (backwards compatibility)
  let code: string | null = null;
  let state: string | null = null;
  let codeVerifier: string | null = null;
  let providerName: string | null = null;

  if (request.method === 'POST') {
    // Parse JSON body for POST requests
    try {
      const body = await request.json() as any;
      code = body.code || null;
      state = body.state || null;
      codeVerifier = body.code_verifier || null;
      providerName = body.provider || 'google';
    } catch (error) {
      // Log detailed error for debugging
      context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
        reason: 'Invalid JSON body',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return sanitized error to user
      return jsonResponse({
        error: 'invalid_request',
        error_description: 'Authentication failed'
      }, 400, undefined, context);
    }
  } else {
    // Fallback to URL parameters for GET requests (backwards compatibility)
    const url = new URL(request.url);
    code = url.searchParams.get('code');
    state = url.searchParams.get('state');
    codeVerifier = url.searchParams.get('code_verifier');
    providerName = url.searchParams.get('provider') || 'google';
  }

  if (!code) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
      reason: 'Missing authorization code'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  if (!state) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
      reason: 'Missing state parameter - possible CSRF attack'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  if (!codeVerifier) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'Missing PKCE code verifier'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // SECURITY: Validate state parameter format to prevent injection attacks
  if (!isValidStateParameter(state)) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
      reason: 'Invalid state parameter format',
      stateLength: state.length
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Retrieve the stored code challenge from KV using state as key
  const storedChallengeData = await env.OAUTH_SESSIONS.get(`pkce:${state}`);
  if (!storedChallengeData) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'No stored PKCE challenge found'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Parse the stored challenge data
  let challengeInfo;
  try {
    challengeInfo = JSON.parse(storedChallengeData);
  } catch (error) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'Invalid stored challenge data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Validate the state parameter for CSRF protection
  // The state must be present in stored data and must match exactly
  if (!challengeInfo.state) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'Missing stored state - invalid session data'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }
  
  if (challengeInfo.state !== state) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'State parameter mismatch - possible CSRF attack',
      received: state,
      expected: '***' // Don't log the actual expected state for security
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Check if the session has expired
  if (challengeInfo.expiresAt && Date.now() > challengeInfo.expiresAt) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'PKCE session expired'
    });
    // Clean up expired session
    await env.OAUTH_SESSIONS.delete(`pkce:${state}`);
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Validate the PKCE code verifier
  const isValid = await validatePKCE(codeVerifier, challengeInfo.challenge);
  if (!isValid) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'PKCE verification failed'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  // Clean up the stored challenge after successful validation
  await env.OAUTH_SESSIONS.delete(`pkce:${state}`);

  context.log(AuditEventType.PKCE_VERIFICATION_SUCCESS, 'success', {
    state
  });

  const provider = getGoogleProvider(env);
  
  try {
    // Discovery document for Google OAuth
    const as = await oauth.discoveryRequest(provider.authorizationServer)
      .then(res => oauth.processDiscoveryResponse(provider.authorizationServer, res));

    // Create OAuth client for PKCE flow (public client)
    const client: oauth.Client = {
      client_id: provider.clientId,
      token_endpoint_auth_method: 'none' // Public client for PKCE
    };

    // Create parameters for token exchange
    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', provider.redirectUri);
    params.set('client_id', provider.clientId);
    params.set('code_verifier', codeVerifier);

    // Exchange code for tokens with proper validation
    const tokenResponse = await fetch(as.token_endpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    // Process the token response with oauth4webapi for signature validation
    let tokens;
    try {
      // oauth4webapi validates JWT signature against Google's JWKS
      tokens = await oauth.processAuthorizationCodeResponse(
        as,
        client,
        tokenResponse
      );
      
      // Check if tokens is an error response (it would throw if error)
    } catch (error) {
      // Log detailed error for debugging
      context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', { 
        reason: 'Token response validation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return sanitized error to user
      return jsonResponse({
        error: 'invalid_grant',
        error_description: 'Authentication failed'
      }, 400, undefined, context);
    }

    // Get validated ID token claims (oauth4webapi performed signature verification)
    let claims;
    try {
      // oauth4webapi's getValidatedIdTokenClaims returns the claims from a validated ID token
      // The validation happened in processAuthorizationCodeOpenIDResponse
      claims = oauth.getValidatedIdTokenClaims(tokens);
      
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
      if (!audience.includes(provider.clientId)) {
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
    } catch (error) {
      // Log detailed error for debugging
      context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', { 
        reason: 'ID token validation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Return sanitized error to user
      return jsonResponse({
        error: 'invalid_grant',
        error_description: 'Authentication failed'
      }, 400, undefined, context);
    }

    const sessionData = {
      provider: provider.name,
      userId: claims.sub,
      email: claims.email,
      name: claims.name,
      picture: claims.picture,
      expiresAt: Date.now() + ((tokens.expires_in ?? 3600) * 1000),
      state
    };

    context.log(AuditEventType.PKCE_FLOW_COMPLETED, 'success', {
      provider: provider.name,
      userId: sessionData.userId
    });

    return new Response(JSON.stringify({ success: true, session: sessionData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    // Return sanitized error to user
    return jsonResponse({
      error: 'server_error',
      error_description: 'Authentication failed'
    }, 500, undefined, context);
  }
}