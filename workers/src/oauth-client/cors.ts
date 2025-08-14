// @agent: cloudflare-backend
/**
 * Simple CORS configuration for OAuth client
 */

import type { RequestContext } from '../utils/request-context';
import { applySecurityHeaders } from '../utils/security-headers';
import type { Env } from './types';

export function getAllowedOrigins(env?: Env): string[] {
  // Use environment variable if available
  if (env?.ALLOWED_ORIGINS) {
    return env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Default to production domain only
  return ['https://promptedblog.com'];
}

export function getCorsHeaders(
  origin: string | null,
  _context?: RequestContext,
  env?: Env
): Record<string, string> {
  const allowedOrigins = getAllowedOrigins(env);
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

export function errorResponse(
  error: string,
  message: string,
  status: number,
  origin: string | null,
  context?: RequestContext,
  env?: Env
): Response {
  const response = new Response(JSON.stringify({ 
    error, 
    error_description: message 
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(origin, context, env)
    }
  });
  return applySecurityHeaders(response);
}