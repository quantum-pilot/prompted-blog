// @agent: cloudflare-backend
/**
 * Cookie-based authentication middleware for Hono framework
 * Validates session cookies and attaches user context
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../oauth-client/types';
import type { AuthContext } from '../types/context';
import { SessionManager } from '../oauth-client/session-manager';
import { getSessionFromCookie } from '../utils/cookie-manager';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

/**
 * Cookie-based authentication middleware - validates session from cookies
 * 
 * Usage:
 * app.use('/api/*', authMiddleware())
 * 
 * Sets the following context variables when authenticated:
 * - userId: User's ID
 * - userEmail: User's email
 * - sessionId: Session ID
 * - session: Full session data
 * - context: Request context for logging
 */
export const authMiddleware = (): MiddlewareHandler<{ Bindings: Env } & AuthContext> => {
  return async (c, next) => {
    try {
      // Extract session ID from cookies
      const sessionId = getSessionFromCookie(c.req.raw);
      
      if (!sessionId) {
        return c.json({
          error: 'Unauthorized',
          message: 'No valid session found'
        }, 401);
      }
      
      // Create context and session manager
      const context = await RequestContext.create(c.req.raw, c.env);
      const sessionManager = new SessionManager(c.env);
      
      // Validate session
      const session = await sessionManager.getSession(sessionId, context);
      
      if (!session) {
        context.log(AuditEventType.AUTH_FAILED, 'failure', {
          reason: 'Session is invalid or expired'
        });
        return c.json({
          error: 'Unauthorized',
          message: 'Session is invalid or expired'
        }, 401);
      }
      
      // Attach user info to context for downstream handlers
      c.set('userId', session.userId);
      c.set('userEmail', session.email);
      c.set('sessionId', sessionId);
      c.set('session', session);
      c.set('context', context);
      
      context.log(AuditEventType.AUTH_SUCCESS, 'success', {
        userId: session.userId
      });
      
      // Continue to next middleware/handler
      await next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      return c.json({
        error: 'Unauthorized',
        message: 'Authentication failed'
      }, 401);
    }
  };
};