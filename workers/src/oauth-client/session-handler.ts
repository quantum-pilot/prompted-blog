// @agent: cloudflare-backend
/**
 * Session management handler
 */

import { getCorsHeaders, errorResponse } from './cors';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { SessionManager } from './session-manager';
import type { Env } from './types';
import { isValidSessionId } from './session-validation';

export async function handleSessionGet(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  
  // Extract session ID from Authorization header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
      reason: 'Missing session ID in Authorization header'
    });
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }

  const sessionId = authHeader.substring(7); // Remove 'Bearer ' prefix
  
  // SECURITY: Validate session ID format to prevent injection attacks
  if (!isValidSessionId(sessionId)) {
    context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
      reason: 'Invalid session ID format',
      sessionIdLength: sessionId.length
    });
    return errorResponse('invalid_request', 'Authentication failed', 400, origin, context, env);
  }
  
  const sessionManager = new SessionManager(env);
  const session = await sessionManager.validateSession(sessionId, context);
  
  if (!session) {
    return errorResponse('invalid_grant', 'Authentication failed', 404, origin, context, env);
  }

  // Return session data (excluding sensitive fields)
  return new Response(
    JSON.stringify({
      userId: session.userId,
      email: session.email,
      name: session.name,
      picture: session.picture,
      provider: session.provider,
      expiresAt: session.expiresAt
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

export async function handleHealthCheck(
  request: Request,
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = request.headers.get('Origin');
  
  return new Response(
    JSON.stringify({ status: 'ok', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin, context, env)
      }
    }
  );
}