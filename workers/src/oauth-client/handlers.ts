// @agent: cloudflare-backend
/**
 * OAuth client handler functions
 */

import { getCorsHeaders, errorResponse } from './cors';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { SessionManager } from './session-manager';
import { handleOAuthCallback, getGoogleProvider } from './oauth-handler';
import type { Env } from './types';

/**
 * Validates that a session ID matches the expected format.
 * Session IDs are base64url encoded, 43-44 chars long.
 * Only allow alphanumeric, dash, and underscore (base64url chars).
 */
function isValidSessionId(sessionId: string): boolean {
  // Session IDs are base64url encoded, 43-44 chars long
  // Only allow alphanumeric, dash, and underscore (base64url chars)
  const sessionIdPattern = /^[A-Za-z0-9_-]{43,44}$/;
  return sessionIdPattern.test(sessionId);
}

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

export async function handleInitiateOAuth(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const codeChallenge = url.searchParams.get('code_challenge');
  const state = url.searchParams.get('state');
  const provider = url.searchParams.get('provider') || 'google';

  if (!codeChallenge) {
    // Log detailed error for debugging (if needed)
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  if (!state) {
    // Log detailed error for debugging (if needed)
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  // SECURITY: Validate state parameter format to prevent injection attacks
  if (!isValidStateParameter(state)) {
    // Log detailed error for debugging
    context.log(AuditEventType.PKCE_CHALLENGE_STORE_FAILURE, 'failure', {
      reason: 'Invalid state parameter format',
      stateLength: state.length
    });
    // Return sanitized error to user
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  // Store the code challenge in KV with the state as key
  const challengeData = {
    challenge: codeChallenge,
    state, // Store the state value for validation
    provider,
    createdAt: Date.now(),
    expiresAt: Date.now() + 600000 // 10 minutes expiry
  };

  try {
    await env.OAUTH_SESSIONS.put(
      `pkce:${state}`,
      JSON.stringify(challengeData),
      { expirationTtl: 600 } // 10 minutes TTL
    );

    context.log(AuditEventType.PKCE_CHALLENGE_STORED, 'success', {
      state,
      provider
    });

    // Return the authorization URL for the frontend to redirect to
    const providerConfig = getGoogleProvider(env);
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', providerConfig.clientId);
    authUrl.searchParams.set('redirect_uri', providerConfig.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', providerConfig.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return new Response(JSON.stringify({
      success: true,
      authorizationUrl: authUrl.toString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin, context, env)
      }
    });
  } catch (error) {
    context.log(AuditEventType.PKCE_CHALLENGE_STORE_FAILURE, 'failure', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return errorResponse('storage_error', 'Failed to store PKCE challenge', 500, origin, context, env);
  }
}

export async function handleCallback(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  const response = await handleOAuthCallback(request, env, context);
  
  // If the OAuth handler returned a successful response with session data
  if (response.status === 200) {
    const data = await response.json() as any;
    if (data.success && data.session) {
      // Create session in KV
      const sessionManager = new SessionManager(env);
      const sessionId = await sessionManager.createSession(data.session);
      
      context.log(AuditEventType.AUTH_SESSION_CREATED, 'success', {
        sessionId,
        userId: data.session.userId
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        sessionId,
        expiresAt: data.session.expiresAt 
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin, context, env)
        }
      });
    }
  }
  
  // Pass through error responses with CORS headers
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin, context, env)
    }
  });
}

export async function handleSessionGet(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  
  // SECURITY: Read session ID from Authorization header instead of URL params
  // This prevents session IDs from appearing in server logs and browser history
  const authHeader = request.headers.get('Authorization');
  let sessionId: string | null = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    sessionId = authHeader.substring(7); // Remove "Bearer " prefix
  }
  
  if (!sessionId) {
    // Log detailed error for debugging
    context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
      reason: 'Missing session ID in Authorization header'
    });
    // Return sanitized error to user
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }
  
  // SECURITY: Validate session ID format to prevent injection attacks
  if (!isValidSessionId(sessionId)) {
    // Log validation failure for security monitoring
    context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
      reason: 'Invalid session ID format',
      sessionIdLength: sessionId.length
    });
    // Return sanitized error to user
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }
  
  const sessionManager = new SessionManager(env);
  const session = await sessionManager.validateSession(sessionId, context);
  
  if (!session) {
    // Session validation already logs the failure
    // Return sanitized error to user
    return errorResponse('invalid_grant', 'Authentication failed', 404, origin, context, env);
  }
  
  return new Response(JSON.stringify({
    userId: session.userId,
    email: session.email,
    name: session.name,
    picture: session.picture,
    expiresAt: session.expiresAt
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin, context, env)
    }
  });
}

export async function handleHealthCheck(
  _request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = _request.headers.get('Origin');
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin, context, env)
    }
  });
}