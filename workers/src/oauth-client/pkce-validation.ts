// @agent: cloudflare-backend
/**
 * PKCE challenge validation utilities
 */

import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { validatePKCE } from './oauth-validation';

export async function validateStoredChallenge(
  env: Env, 
  state: string, 
  codeVerifier: string, 
  context: RequestContext
) {
  const storedChallengeData = await env.OAUTH_SESSIONS.get(`pkce:${state}`);
  if (!storedChallengeData) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'No stored PKCE challenge found'
    });
    return null;
  }

  let challengeInfo;
  try {
    challengeInfo = JSON.parse(storedChallengeData);
  } catch (error) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'Invalid stored challenge data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }

  if (!challengeInfo.state || challengeInfo.state !== state ||
      (challengeInfo.expiresAt && Date.now() > challengeInfo.expiresAt)) {
    const reason = !challengeInfo.state ? 'Missing stored state' :
                  challengeInfo.state !== state ? 'State parameter mismatch' :
                  'PKCE session expired';
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', { reason });
    if (challengeInfo.expiresAt && Date.now() > challengeInfo.expiresAt) {
      await env.OAUTH_SESSIONS.delete(`pkce:${state}`);
    }
    return null;
  }

  const isValid = await validatePKCE(codeVerifier, challengeInfo.challenge);
  if (!isValid) {
    context.log(AuditEventType.PKCE_VERIFICATION_FAILURE, 'failure', {
      reason: 'PKCE verification failed'
    });
    return null;
  }

  await env.OAUTH_SESSIONS.delete(`pkce:${state}`);
  context.log(AuditEventType.PKCE_VERIFICATION_SUCCESS, 'success', { state });
  return challengeInfo;
}

export async function parseRequestParams(request: Request, context: RequestContext) {
  if (request.method === 'POST') {
    try {
      const body = await request.json() as any;
      return {
        code: body.code || null,
        state: body.state || null,
        codeVerifier: body.code_verifier || null
      };
    } catch (error) {
      context.log(AuditEventType.AUTH_LOGIN_FAILURE, 'failure', {
        reason: 'Invalid JSON body',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }
  const url = new URL(request.url);
  return {
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    codeVerifier: url.searchParams.get('code_verifier')
  };
}