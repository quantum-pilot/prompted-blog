// @agent: cloudflare-backend
/**
 * Security headers middleware for Hono framework
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../oauth-client/types';
import { getSecurityHeaders } from '../utils/security-headers';

/**
 * Security headers middleware for Hono
 * Applies security headers to all responses
 */
export const securityMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    // Continue to next middleware/handler
    await next();
    
    // Apply security headers to response
    const securityHeaders = getSecurityHeaders();
    
    Object.entries(securityHeaders).forEach(([key, value]) => {
      c.header(key, value);
    });
  };
};