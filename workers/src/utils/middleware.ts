// @agent: cloudflare-backend
// Middleware system for request handling with RequestContext support

import { RequestContext } from "./request-context";
import { AuditLogger } from "./audit-logger";

// Generic environment interface for middleware
interface MiddlewareEnv {
  [key: string]: any;
}

export type MiddlewareHandler = (
  env: MiddlewareEnv,
  context: RequestContext
) => Promise<Response>;

export type Middleware = (handler: MiddlewareHandler) => MiddlewareHandler;

/**
 * Enhanced data access audit middleware that integrates with RequestContext
 */
export function withDataAccessAudit(
  resourceType: string,
  operation: "read" | "write" | "delete"
): Middleware {
  return (handler: MiddlewareHandler) => {
    return async (
      env: MiddlewareEnv,
      context: RequestContext
    ): Promise<Response> => {
      const userId = context.userId || "anonymous";

      try {
        const response = await handler(env, context);

        if (response.status >= 200 && response.status < 300) {
          AuditLogger.logDataAccess(userId, resourceType, operation, true);
        } else if (
          response.status === 400 ||
          response.status === 401 ||
          response.status === 403
        ) {
          AuditLogger.logDataAccess(userId, resourceType, operation, false);
        }

        // Add correlation ID to response headers only if not already set
        const headers = new Headers(response.headers);
        if (!headers.has("X-Correlation-ID")) {
          headers.set("X-Correlation-ID", context.correlationId);
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        AuditLogger.logDataAccess(userId, resourceType, operation, false);
        throw error;
      }
    };
  };
}

/**
 * Compose multiple middlewares into a single middleware
 */
export function compose(...middlewares: Middleware[]): Middleware {
  return (handler: MiddlewareHandler) => {
    return middlewares.reduceRight(
      (acc, middleware) => middleware(acc),
      handler
    );
  };
}

/**
 * Convert a traditional handler to a middleware-compatible handler
 */
export function adaptHandler(
  handler: (
    env: MiddlewareEnv,
    origin: string | null,
    request?: Request
  ) => Promise<Response>
): MiddlewareHandler {
  return async (
    env: MiddlewareEnv,
    context: RequestContext
  ): Promise<Response> => {
    const origin = context.request.headers.get("Origin");
    // Pass the context-enriched request to the handler
    const enrichedRequest = context.propagate();
    return handler(env, origin, enrichedRequest);
  };
}

/**
 * Convert a callback handler to a middleware-compatible handler
 */
export function adaptCallbackHandler(
  handler: (
    url: URL,
    env: MiddlewareEnv,
    origin: string | null,
    request?: Request
  ) => Promise<Response>
): MiddlewareHandler {
  return async (
    env: MiddlewareEnv,
    context: RequestContext
  ): Promise<Response> => {
    const url = new URL(context.request.url);
    const origin = context.request.headers.get("Origin");
    // Pass the context-enriched request to the handler
    const enrichedRequest = context.propagate();
    return handler(url, env, origin, enrichedRequest);
  };
}
