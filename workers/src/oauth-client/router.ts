// @agent: cloudflare-backend
/**
 * Simple router for OAuth client endpoints with rate limiting
 */

import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { RateLimiter } from '../utils/rate-limiter';
import { AuditEventType } from '../utils/audit-logger';
import { applySecurityHeaders } from '../utils/security-headers';

export type RouteHandler = (
  request: Request,
  env: Env,
  context: RequestContext,
  params?: Record<string, string>
) => Promise<Response> | Response;

export interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  rateLimit?: {
    limit: number;
    windowMs: number;
  };
}

export class Router {
  private routes: Route[] = [];
  private rateLimiters: Map<string, RateLimiter> = new Map();

  get(path: string, handler: RouteHandler, rateLimit?: { limit: number; windowMs: number }): void {
    this.routes.push({ method: 'GET', path, handler, rateLimit });
  }

  post(path: string, handler: RouteHandler, rateLimit?: { limit: number; windowMs: number }): void {
    this.routes.push({ method: 'POST', path, handler, rateLimit });
  }

  async handle(
    request: Request,
    env: Env,
    context: RequestContext
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      // Simple exact match for now
      if (route.path === path) {
        // Check rate limit if configured for this route
        if (route.rateLimit) {
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
        }
        const response = await route.handler(request, env, context);
        return applySecurityHeaders(response);
      }

      // Handle path parameters (simple implementation)
      const routeParts = route.path.split('/');
      const pathParts = path.split('/');

      if (routeParts.length !== pathParts.length) continue;

      const params: Record<string, string> = {};
      let match = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Check rate limit if configured for this route
        if (route.rateLimit) {
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
        }
        const response = await route.handler(request, env, context, params);
        return applySecurityHeaders(response);
      }
    }

    return null;
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