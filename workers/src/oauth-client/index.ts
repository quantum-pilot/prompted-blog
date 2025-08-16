// @agent: cloudflare-backend
/**
 * Simple OAuth client handler for Cloudflare Workers
 * Handles OAuth callbacks and session management only
 */

import { getCorsHeaders, errorResponse } from './cors';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';
import { Router } from './router';
import { handleCallback, handleSessionGet, handleHealthCheck, handleInitiateOAuth } from './handlers';
import { applySecurityHeaders } from '../utils/security-headers';
import type { Env } from './types';

export type { Env };

const router = new Router();

// OAuth initiation endpoint - stores PKCE challenge and returns auth URL
router.get('/oauth/authorize', handleInitiateOAuth);

// OAuth callback endpoint - handles authorization code exchange with PKCE validation
// Support both GET (backwards compatibility) and POST (improved security) methods
// Apply rate limiting: 10 requests per minute per IP to prevent brute force attacks
router.get('/oauth/callback', handleCallback, {
  limit: 10,
  windowMs: 60 * 1000 // 1 minute
});

router.post('/oauth/callback', handleCallback, {
  limit: 10,
  windowMs: 60 * 1000 // 1 minute
});

// Session validation endpoint
router.get('/oauth/session', handleSessionGet);

// Health check endpoint
router.get('/health', handleHealthCheck);

export default {
  async fetch(request: Request, env: Env, _ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const context = await RequestContext.create(request, env);

    try {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        const response = new Response(null, {
          status: 204,
          headers: getCorsHeaders(origin, context, env)
        });
        return applySecurityHeaders(response);
      }

      // Try to route the request
      const response = await router.handle(request, env, context);

      if (response) {
        return response;
      }

      // No matching route found
      context.log(AuditEventType.ROUTE_NOT_FOUND, 'failure', {
        path: url.pathname,
        method: request.method
      });

      return errorResponse('not_found', 'Route not found', 404, origin, context, env);
    } catch (error) {
      console.error('OAuth client error:', error);
      context.log(AuditEventType.REQUEST_ERROR, 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: url.pathname
      });

      return errorResponse(
        'internal_error',
        'An unexpected error occurred',
        500,
        origin,
        context,
        env
      );
    }
  }
};
