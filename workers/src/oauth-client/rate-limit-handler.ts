// @agent: cloudflare-backend
/**
 * Rate limiting handler for OAuth routes
 */

import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { RateLimiter } from '../utils/rate-limiter';
import { AuditEventType } from '../utils/audit-logger';
import { applySecurityHeaders } from '../utils/security-headers';
import type { Route } from './router';

export class RateLimitHandler {
  private rateLimiters: Map<string, RateLimiter> = new Map();

  async checkAndHandleRateLimit(
    request: Request,
    env: Env,
    route: Route,
    context: RequestContext
  ): Promise<Response | null> {
    if (!route.rateLimit) {
      return null; // No rate limiting configured
    }

    const allowed = await this.checkRateLimit(request, env, route, context);
    if (!allowed) {
      const response = new Response(
        JSON.stringify({ error: 'rate_limit_exceeded', message: 'Too many requests' }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(route.rateLimit.windowMs / 1000))
          }
        }
      );
      return applySecurityHeaders(response);
    }

    return null; // Rate limit check passed
  }

  private async checkRateLimit(
    request: Request,
    env: Env,
    route: Route,
    context: RequestContext
  ): Promise<boolean> {
    const routeKey = `${route.method}:${route.path}`;
    
    // Get or create rate limiter for this route
    if (!this.rateLimiters.has(routeKey) && route.rateLimit) {
      this.rateLimiters.set(routeKey, new RateLimiter({
        kv: env.OAUTH_SESSIONS,
        limit: route.rateLimit.limit,
        windowMs: route.rateLimit.windowMs,
        keyPrefix: `rate-limit:${routeKey}`
      }));
    }

    const rateLimiter = this.rateLimiters.get(routeKey);
    if (!rateLimiter) return true; // No rate limiter configured

    const clientIp = RateLimiter.getClientIp(request);
    const allowed = await rateLimiter.isAllowed(clientIp);

    if (!allowed) {
      context.log(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, 'failure', {
        path: route.path,
        clientIp,
        limit: route.rateLimit?.limit,
        windowMs: route.rateLimit?.windowMs
      });
    }

    return allowed;
  }
}