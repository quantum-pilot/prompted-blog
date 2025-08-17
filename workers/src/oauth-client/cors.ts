// @agent: cloudflare-backend
/**
 * Simple CORS configuration for OAuth client
 */

import type { RequestContext } from "../utils/request-context";
import { applySecurityHeaders } from "../utils/security-headers";
import type { Env } from "./types";

export function isAllowedOrigin(origin: string | null, env?: Env): boolean {
  if (!origin) return false;

  // Use environment variable if available
  if (env?.ALLOWED_ORIGINS) {
    const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((origin) =>
      origin.trim()
    );
    return allowedOrigins.includes(origin);
  }

  // Check if origin is from promptedblog.com or any subdomain
  try {
    const url = new URL(origin);
    // Allow any subdomain of promptedblog.com (including www, staging, etc.)
    // Only allow HTTPS
    return (
      url.protocol === "https:" &&
      (url.hostname === "promptedblog.com" ||
        url.hostname.endsWith(".promptedblog.com"))
    );
  } catch {
    return false;
  }
}

export function getCorsHeaders(
  context?: RequestContext,
  env?: Env
): Record<string, string> {
  const origin = context?.origin || null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && isAllowedOrigin(origin, env)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  return headers;
}

export function errorResponse(
  error: string,
  message: string,
  status: number,
  context?: RequestContext,
  env?: Env
): Response {
  const response = new Response(
    JSON.stringify({
      error,
      error_description: message,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(context, env),
      },
    }
  );
  return applySecurityHeaders(response);
}
