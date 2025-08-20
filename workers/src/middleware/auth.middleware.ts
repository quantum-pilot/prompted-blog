// @agent: cloudflare-backend
/**
 * Authentication middleware for Hono framework
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../oauth-client/types';
import type { AuthContext } from '../types/context';
import { SessionManager } from '../oauth-client/session-manager';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { HttpStatus } from '../../../shared';

// Helper to extract Bearer token
const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : null;
};

// Helper to create unauthorized response
const unauthorizedResponse = (c: any, description: string) => 
  c.json(
    { error: 'unauthorized', error_description: description },
    HttpStatus.UNAUTHORIZED,
    { 'WWW-Authenticate': 'Bearer realm="OAuth Session"' }
  );

/**
 * Authentication middleware - validates Bearer token and sets user context
 */
export const authMiddleware = (): MiddlewareHandler<{ Bindings: Env } & AuthContext> => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const sessionId = extractBearerToken(authHeader || null);
    const context = await RequestContext.create(c.req.raw, c.env);
    const path = new URL(c.req.url).pathname;
    
    if (!sessionId) {
      context.log(AuditEventType.AUTH_FAILED, 'failure', {
        reason: 'Missing or invalid Bearer token', path
      });
      return unauthorizedResponse(c, 'Missing or invalid authorization token');
    }
    
    const sessionManager = new SessionManager(c.env);
    const session = await sessionManager.validateSession(sessionId, context);
    
    if (!session) {
      context.log(AuditEventType.AUTH_FAILED, 'failure', {
        reason: 'Invalid or expired session', path
      });
      return unauthorizedResponse(c, 'Invalid or expired session');
    }
    
    // Set user context
    c.set('userId', session.userId);
    c.set('userEmail', session.email);
    c.set('sessionId', sessionId);
    c.set('session', session);
    c.set('context', context);
    
    context.log(AuditEventType.AUTH_SUCCESS, 'success', {
      userId: session.userId, path
    });
    
    await next();
  };
};

/**
 * Optional auth middleware - validates token if present but doesn't require it
 */
export const optionalAuthMiddleware = (): MiddlewareHandler<{ Bindings: Env } & AuthContext> => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    const sessionId = extractBearerToken(authHeader || null);
    
    if (sessionId) {
      const context = await RequestContext.create(c.req.raw, c.env);
      const sessionManager = new SessionManager(c.env);
      const session = await sessionManager.validateSession(sessionId, context);
      
      if (session) {
        c.set('userId', session.userId);
        c.set('userEmail', session.email);
        c.set('sessionId', sessionId);
        c.set('session', session);
        c.set('context', context);
      }
    }
    
    await next();
  };
};