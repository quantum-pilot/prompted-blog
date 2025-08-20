// @agent: cloudflare-backend
/**
 * CORS utility functions
 */

import { buildCorsHeaders } from "../../../shared";
import type { Env } from "../oauth-client/types";
import type { RequestContext } from "./request-context";

/**
 * Check if origin is allowed
 */
export function isAllowedOrigin(origin: string | null, env?: Env): boolean {
  if (!origin) return false;

  // Use environment variable if available
  if (env?.ALLOWED_ORIGINS) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) =>
      o.trim()
    );
    return allowedOrigins.includes(origin);
  }

  // Check if origin is from promptedblog.com or any subdomain
  try {
    const url = new URL(origin);
    // Allow any subdomain of promptedblog.com (including www, staging, etc.)
    // Only allow HTTPS
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'promptedblog.com' ||
        url.hostname.endsWith('.promptedblog.com'))
    );
  } catch {
    return false;
  }
}

/**
 * Get CORS headers for a request
 */
export function getCorsHeaders(
  context?: RequestContext | { origin: string | null },
  env?: Env
): Record<string, string> {
  const origin = context && 'origin' in context ? context.origin : (context as RequestContext | undefined)?.request?.headers.get('Origin') || null;
  
  // Use shared CORS header builder when origin is allowed
  if (origin && isAllowedOrigin(origin, env)) {
    return buildCorsHeaders({
      origin,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      headers: ["Content-Type", "Authorization"]
    });
  }
  
  // Return default headers without Access-Control-Allow-Origin if origin not allowed
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}