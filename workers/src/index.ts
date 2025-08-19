// @agent: cloudflare-backend
/**
 * Main Cloudflare Worker with Hono
 */

import { Hono } from 'hono';
import { RequestContext } from './utils/request-context';
import { AuditEventType } from './utils/audit-logger';
import { HttpStatus } from '../../shared';

// Import middleware
import { corsMiddleware } from './middleware/cors.middleware';
import { securityMiddleware } from './middleware/security.middleware';
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth.middleware';

// Import route modules
import oauthRoutes from './routes/oauth.route';
import sessionRoutes from './routes/session.route';
import healthRoutes from './routes/health.route';

import type { Env } from './oauth-client/types';

export type { Env };

// Create main Hono app with context variables
const app = new Hono<{
  Bindings: Env;
  Variables: {
    userId?: string;
    userEmail?: string;
    sessionId?: string;
    session?: any;
    context?: RequestContext;
  };
}>();

// Apply middleware in correct order
// 1. CORS middleware (handles preflight and sets CORS headers)
app.use('*', corsMiddleware());

// 2. Security headers middleware (applies to all responses)
app.use('*', securityMiddleware());

// 3. Rate limiting for specific endpoints
app.use('/oauth/callback', rateLimitMiddleware(10, 60 * 1000)); // 10 requests per minute
app.use('/oauth/authorize', rateLimitMiddleware(20, 60 * 1000)); // 20 requests per minute
app.use('/oauth/token', rateLimitMiddleware(10, 60 * 1000)); // 10 requests per minute

// 4. Authentication middleware for protected routes
// Apply auth middleware to session endpoints (except health check)
app.use('/session/*', authMiddleware());
app.use('/oauth/userinfo', authMiddleware());

// Optional auth for certain routes
app.use('/oauth/logout', optionalAuthMiddleware());

// Mount routes
app.route('/', oauthRoutes);
app.route('/', sessionRoutes);
app.route('/', healthRoutes);

// 404 handler
app.notFound(async (c) => {
  const context = await RequestContext.create(c.req.raw, c.env);
  
  context.log(AuditEventType.ROUTE_NOT_FOUND, 'failure', {
    path: new URL(c.req.url).pathname,
    method: c.req.method,
  });
  
  return c.json(
    {
      error: 'not_found',
      error_description: 'Route not found',
    },
    HttpStatus.NOT_FOUND
  );
});

// Error handler
app.onError(async (err, c) => {
  console.error('Worker error:', err);
  
  const context = await RequestContext.create(c.req.raw, c.env);
  
  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    context.log(AuditEventType.REQUEST_ERROR, 'failure', {
      error: 'Validation error',
      path: new URL(c.req.url).pathname,
    });
    
    return c.json(
      {
        error: 'invalid_request',
        error_description: 'Missing or invalid parameters',
      },
      HttpStatus.BAD_REQUEST
    );
  }
  
  context.log(AuditEventType.REQUEST_ERROR, 'failure', {
    error: err instanceof Error ? err.message : 'Unknown error',
    path: new URL(c.req.url).pathname,
  });
  
  return c.json(
    {
      error: 'internal_error',
      error_description: 'An unexpected error occurred',
    },
    HttpStatus.INTERNAL_SERVER_ERROR
  );
});

// Export type for RPC client
export type AppType = typeof app;

// Export the Hono app for Cloudflare Workers
export default app;