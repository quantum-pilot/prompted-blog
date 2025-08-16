// @agent: cloudflare-backend
/**
 * OAuth callback handler using oauth4webapi for PKCE flow
 */

import * as oauth from 'oauth4webapi';
import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { isValidStateParameter } from './oauth-validation';
import { exchangeCodeForTokens, validateGoogleIdToken } from './token-handler';
import { extractUserInfo } from './user-info-handler';
import { jsonResponse, logAndReturnError } from './oauth-errors';
import { validateStoredChallenge, parseRequestParams } from './pkce-validation';
import { getGoogleProvider } from './oauth-provider';

export type { OAuthProvider } from './oauth-provider';
export { getGoogleProvider } from './oauth-provider';

export async function handleOAuthCallback(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const params = await parseRequestParams(request, context);
  if (!params) {
    return jsonResponse({
      error: 'invalid_request',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  const { code, state, codeVerifier } = params;
  if (!code || !state || !codeVerifier) {
    const reason = !code ? 'Missing authorization code' : 
                  !state ? 'Missing state parameter - possible CSRF attack' :
                  'Missing PKCE code verifier';
    return logAndReturnError(
      context,
      !codeVerifier ? AuditEventType.PKCE_VERIFICATION_FAILURE : AuditEventType.AUTH_LOGIN_FAILURE,
      reason,
      'invalid_request',
      400
    );
  }

  if (!isValidStateParameter(state)) {
    return logAndReturnError(
      context,
      AuditEventType.AUTH_LOGIN_FAILURE,
      'Invalid state parameter format',
      'invalid_request',
      400
    );
  }

  const challengeInfo = await validateStoredChallenge(env, state, codeVerifier, context);
  if (!challengeInfo) {
    return jsonResponse({
      error: 'invalid_grant',
      error_description: 'Authentication failed'
    }, 400, undefined, context);
  }

  const provider = getGoogleProvider(env);
  try {
    const as = await oauth.discoveryRequest(provider.authorizationServer)
      .then(res => oauth.processDiscoveryResponse(provider.authorizationServer, res));

    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      clientId: provider.clientId,
      redirectUri: provider.redirectUri,
      tokenEndpoint: as.token_endpoint!
    }, as, context);

    let claims;
    try {
      claims = validateGoogleIdToken(tokens, provider.clientId, context);
    } catch (error) {
      return logAndReturnError(
        context,
        AuditEventType.AUTH_LOGIN_FAILURE,
        'ID token validation failed',
        'invalid_grant',
        400,
        error
      );
    }

    const sessionData = extractUserInfo(claims, provider.name, state, tokens.expires_in);
    context.log(AuditEventType.PKCE_FLOW_COMPLETED, 'success', {
      provider: provider.name,
      userId: sessionData.userId
    });

    return new Response(JSON.stringify({ success: true, session: sessionData }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return logAndReturnError(
      context,
      AuditEventType.AUTH_LOGIN_FAILURE,
      'OAuth flow failed',
      'server_error',
      500,
      error
    );
  }
}