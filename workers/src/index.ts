// @agent: cloudflare-backend
/**
 * Main Cloudflare Worker entrypoint
 * Handles OAuth flow and session management
 */

import { getCorsHeaders } from "./oauth-client/cors";
import { HTTP_STATUS } from "../../shared";
import { RequestContext } from "./utils/request-context";
import { AuditEventType } from "./utils/audit-logger";
import { Router } from "./utils/router";
import {
  handleCallback,
  handleSessionGet,
  handleHealthCheck,
  handleInitiateOAuth,
} from "./oauth-client/handlers";
import { applySecurityHeaders } from "./utils/security-headers";
import type { Env } from "./oauth-client/types";

export type { Env };

const router = new Router();

// OAuth initiation endpoint - stores PKCE challenge and returns auth URL
router.get("/oauth/authorize", handleInitiateOAuth);

// OAuth callback endpoint - handles authorization code exchange with PKCE validation
// Apply rate limiting: 10 requests per minute per IP to prevent brute force attacks
router.post("/oauth/callback", handleCallback, {
  limit: 10,
  windowMs: 60 * 1000, // 1 minute
});

// Session validation endpoint
router.get("/oauth/session", handleSessionGet);

// Health check endpoint
router.get("/health", handleHealthCheck);

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const context = await RequestContext.create(request, env);

    try {
      // Handle CORS preflight
      if (request.method === "OPTIONS") {
        const response = new Response(null, {
          status: 204,
          headers: getCorsHeaders(context, env),
        });
        return applySecurityHeaders(response);
      }

      // Try to route the request
      const response = await router.handle(request, env, context);
      if (response) {
        return response;
      }

      // No matching route found
      context.log(AuditEventType.ROUTE_NOT_FOUND, "failure", {
        path: url.pathname,
        method: request.method,
      });

      return context.errorResponse(
        HTTP_STATUS.NOT_FOUND,
        "not_found",
        "Route not found",
        env
      );
    } catch (error) {
      console.error("Worker error:", error);
      context.log(AuditEventType.REQUEST_ERROR, "failure", {
        error: error instanceof Error ? error.message : "Unknown error",
        path: url.pathname,
      });

      return context.errorResponse(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        "internal_error",
        "An unexpected error occurred",
        env
      );
    }
  },
};
