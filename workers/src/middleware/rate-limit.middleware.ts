// @agent: cloudflare-backend
/**
 * Rate limiting middleware for Hono framework
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../oauth-client/types';
import { RateLimiter } from '../utils/rate-limiter';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

/**
 * Rate limiting middleware for Hono
 * Uses KV storage to track requests per IP address
 * Default: 10 requests per minute
 */
export const rateLimitMiddleware = (
  limit = 10,
  windowMs = 60 * 1000
): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    // Use OAUTH_SESSIONS for rate limiting
    const kvNamespace = c.env.OAUTH_SESSIONS;
    
    // Only rate limit if KV namespace is available
    if (!kvNamespace) {
      await next();
      return;
    }
    
    try {
      // Get client IP from Cloudflare header
      const clientIp = RateLimiter.getClientIp(c.req.raw);
      
      // Create rate limiter instance
      const rateLimiter = new RateLimiter({
        kv: kvNamespace,
        limit,
        windowMs,
        keyPrefix: 'rate-limit'
      });
      
      // Check if request is allowed
      const allowed = await rateLimiter.isAllowed(clientIp);
      
      if (!allowed) {
        // Create context for logging
        const context = await RequestContext.create(c.req.raw, c.env);
        
        context.log(AuditEventType.RATE_LIMIT_EXCEEDED, 'failure', {
          ip: clientIp,
          limit,
          window: windowMs,
          path: new URL(c.req.url).pathname
        });
        
        return c.json(
          {
            success: false,
            error: 'rate_limit_exceeded',
            error_description: 'Too many requests',
            message: 'Too many requests', // For backward compatibility
          },
          429,
          {
            'Retry-After': String(Math.ceil(windowMs / 1000)),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Window': String(windowMs),
          }
        );
      }
      
      // Continue to next middleware/handler
      await next();
      
      // Add rate limit headers to response
      c.header('X-RateLimit-Limit', String(limit));
      c.header('X-RateLimit-Window', String(windowMs));
      
    } catch (error) {
      // Log error but don't block request
      console.error('Rate limit middleware error:', error);
      
      // Continue without rate limiting if there's an error
      await next();
    }
  };
};