// @agent: cloudflare-backend
/**
 * OAuth authorization initiation handler
 */

import { getCorsHeaders, errorResponse } from './cors';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { getGoogleProvider } from './oauth-provider';
import type { Env } from './types';
import { isValidStateParameter } from './session-validation';

function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest('SHA-256', data).then(buffer =>
    btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  );
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
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  if (!state) {
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  // SECURITY: Validate state parameter format to prevent injection attacks
  if (!isValidStateParameter(state)) {
    context.log(AuditEventType.PKCE_CHALLENGE_STORE_FAILURE, 'failure', {
      reason: 'Invalid state parameter format',
      stateLength: state.length
    });
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  // Store the PKCE challenge with a 10-minute expiration
  const challengeData = {
    challenge: codeChallenge,
    state,
    provider,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
  };

  await env.OAUTH_SESSIONS.put(
    `pkce:${state}`,
    JSON.stringify(challengeData),
    { expirationTtl: 600 } // 10 minutes
  );

  context.log(AuditEventType.PKCE_CHALLENGE_STORED, 'success', {
    state,
    provider
  });

  // Get provider configuration
  const providerConfig = getGoogleProvider(env);
  
  // Build authorization URL
  const authUrl = new URL('/o/oauth2/v2/auth', providerConfig.authorizationServer);
  authUrl.searchParams.set('client_id', providerConfig.clientId);
  authUrl.searchParams.set('redirect_uri', providerConfig.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', providerConfig.scopes.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return new Response(
    JSON.stringify({ 
      success: true,
      authorizationUrl: authUrl.toString() 
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin, context, env)
      }
    }
  );
}