// @agent: cloudflare-backend
/**
 * CORS middleware for Hono framework
 */

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../oauth-client/types';
import { isAllowedOrigin, getCorsHeaders } from '../utils/cors-utils';

/**
 * CORS middleware for Hono
 * Handles preflight requests and adds CORS headers to responses
 */
export const corsMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const origin = c.req.header('Origin') || null;
    
    // Get CORS headers using the utility function
    const corsHeaders = getCorsHeaders({ origin }, c.env);
    
    // Handle preflight OPTIONS requests
    if (c.req.method === 'OPTIONS') {
      return new Response('', {
        status: 204,
        headers: corsHeaders
      });
    }
    
    // Continue to next middleware/handler
    await next();
    
    // Add CORS headers to response
    Object.entries(corsHeaders).forEach(([key, value]) => {
      c.header(key, value);
    });
  };
};