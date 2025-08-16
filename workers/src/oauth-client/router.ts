// @agent: cloudflare-backend
/**
 * Simple router for OAuth client endpoints with rate limiting
 */

import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { applySecurityHeaders } from '../utils/security-headers';
import { RateLimitHandler } from './rate-limit-handler';

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
  private rateLimitHandler = new RateLimitHandler();

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
        const rateLimitResponse = await this.rateLimitHandler.checkAndHandleRateLimit(
          request, env, route, context
        );
        if (rateLimitResponse) return rateLimitResponse;
        
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
        const rateLimitResponse = await this.rateLimitHandler.checkAndHandleRateLimit(
          request, env, route, context
        );
        if (rateLimitResponse) return rateLimitResponse;
        
        const response = await route.handler(request, env, context, params);
        return applySecurityHeaders(response);
      }
    }

    return null;
  }
}