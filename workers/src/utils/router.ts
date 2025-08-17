// @agent: cloudflare-backend
/**
 * Reusable router utility for Cloudflare Workers with integrated rate limiting
 */

import type { RequestContext } from "./request-context";
import { applySecurityHeaders } from "./security-headers";
import { RateLimiter } from "./rate-limiter";
import { AuditEventType } from "./audit-logger";
import { AuditedKVStore } from "./audit-kvstore";
import { HTTP_STATUS } from "../../../shared";

export type RouteHandler<T = any> = (
  env: T,
  context: RequestContext,
  params?: Record<string, string>
) => Promise<Response> | Response;

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface Route<T = any> {
  method: string;
  path: string;
  handler: RouteHandler<T>;
  rateLimit?: RateLimitConfig;
}

export class Router<T extends { OAUTH_SESSIONS: KVNamespace } = any> {
  private routes: Route<T>[] = [];
  private rateLimiters: Map<string, RateLimiter> = new Map();

  get(
    path: string,
    handler: RouteHandler<T>,
    rateLimit?: RateLimitConfig
  ): void {
    this.routes.push({ method: "GET", path, handler, rateLimit });
  }

  post(
    path: string,
    handler: RouteHandler<T>,
    rateLimit?: RateLimitConfig
  ): void {
    this.routes.push({ method: "POST", path, handler, rateLimit });
  }

  put(
    path: string,
    handler: RouteHandler<T>,
    rateLimit?: RateLimitConfig
  ): void {
    this.routes.push({ method: "PUT", path, handler, rateLimit });
  }

  delete(
    path: string,
    handler: RouteHandler<T>,
    rateLimit?: RateLimitConfig
  ): void {
    this.routes.push({ method: "DELETE", path, handler, rateLimit });
  }

  async handle(
    request: Request,
    env: T,
    context: RequestContext
  ): Promise<Response | null> {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    for (const route of this.routes) {
      if (route.method !== method) continue;

      // Simple exact match
      if (route.path === path) {
        // Check rate limit if configured for this route
        const rateLimitResponse = await this.checkRateLimit(
          request,
          env,
          route,
          context
        );
        if (rateLimitResponse) return rateLimitResponse;

        const response = await route.handler(env, context);
        return applySecurityHeaders(response);
      }

      // Handle path parameters (simple implementation)
      const routeParts = route.path.split("/");
      const pathParts = path.split("/");

      if (routeParts.length !== pathParts.length) continue;

      const params: Record<string, string> = {};
      let match = true;

      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(":")) {
          params[routeParts[i].slice(1)] = pathParts[i];
        } else if (routeParts[i] !== pathParts[i]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Check rate limit if configured for this route
        const rateLimitResponse = await this.checkRateLimit(
          request,
          env,
          route,
          context
        );
        if (rateLimitResponse) return rateLimitResponse;

        const response = await route.handler(env, context, params);
        return applySecurityHeaders(response);
      }
    }

    return null;
  }

  private async checkRateLimit(
    request: Request,
    env: T,
    route: Route<T>,
    context: RequestContext
  ): Promise<Response | null> {
    if (!route.rateLimit) {
      return null; // No rate limiting configured
    }

    const routeKey = `${route.method}:${route.path}`;

    // Get or create rate limiter for this route with AuditedKVStore
    if (!this.rateLimiters.has(routeKey)) {
      const auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
      this.rateLimiters.set(
        routeKey,
        new RateLimiter({
          kv: env.OAUTH_SESSIONS, // RateLimiter uses KV directly for now
          limit: route.rateLimit.limit,
          windowMs: route.rateLimit.windowMs,
          keyPrefix: `rate-limit:${routeKey}`,
        })
      );
    }

    const rateLimiter = this.rateLimiters.get(routeKey)!;
    const clientIp = RateLimiter.getClientIp(request);
    const allowed = await rateLimiter.isAllowed(clientIp);

    if (!allowed) {
      context.log(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, "failure", {
        path: route.path,
        clientIp,
        limit: route.rateLimit.limit,
        windowMs: route.rateLimit.windowMs,
      });

      const response = new Response(
        JSON.stringify({
          error: "rate_limit_exceeded",
          message: "Too many requests",
        }),
        {
          status: HTTP_STATUS.TOO_MANY_REQUESTS,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil(route.rateLimit.windowMs / 1000)),
          },
        }
      );
      return applySecurityHeaders(response);
    }

    return null; // Rate limit check passed
  }
}
