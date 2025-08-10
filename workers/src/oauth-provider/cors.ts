// @agent: cloudflare-backend
// CORS headers configuration and handling
import { AuditLogger, AuditEventType } from '../utils/audit-logger';
import { RequestContext } from '../utils/request-context';

// Whitelist of allowed origins
const ALLOWED_ORIGINS = [
  'https://promptedblog.com',
  'http://localhost:8000', // for development
];

/**
 * Get CORS headers for a given origin
 * @param origin - The origin from the request
 * @param context - RequestContext for audit logging (contains request)
 * @returns CORS headers if origin is allowed, empty object otherwise
 */
export function getCorsHeaders(origin: string | null, context?: RequestContext): HeadersInit {
  // If no origin or origin not in whitelist, return no CORS headers
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    // Audit log: CORS violation if origin is provided but not allowed
    if (origin) {
      if (context) {
        context.log(AuditEventType.CORS_VIOLATION, 'failure', {
          origin,
          method: context.request.method,
          path: new URL(context.request.url).pathname,
          reason: 'Origin not in whitelist',
          allowedOrigins: ALLOWED_ORIGINS
        });
      } else {
        // Fallback logging when no context available (should be rare)
        AuditLogger.log(AuditEventType.CORS_VIOLATION, 'failure', {
          metadata: {
            origin,
            reason: 'Origin not in whitelist',
            allowedOrigins: ALLOWED_ORIGINS
          }
        });
      }
    }
    return {};
  }

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCorsOptions(context: RequestContext): Response {
  const origin = context.request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin, context),
  });
}

export function addCorsHeaders(headers: HeadersInit = {}, origin: string | null, context?: RequestContext): HeadersInit {
  return {
    ...headers,
    ...getCorsHeaders(origin, context),
  };
}

export function jsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: HeadersInit = {},
  origin: string | null = null,
  context?: RequestContext
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json',
      ...additionalHeaders,
    }, origin, context),
  });
}

export function errorResponse(
  error: string,
  messageOrDescription: string,
  status: number = 500,
  origin: string | null = null,
  context?: RequestContext,
  correlationId?: string
): Response {
  const finalCorrelationId = correlationId || context?.correlationId || context?.request.headers.get('X-Correlation-ID') ||
    `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  console.error(`OAuth Error: ${error} - ${messageOrDescription}`, { correlationId: finalCorrelationId });

  // Support both 'message' and 'error_description' fields
  const data: any = {
    error,
    correlation_id: finalCorrelationId
  };

  if (error === 'access_denied' || error === 'invalid_grant') {
    data.error_description = messageOrDescription;
  } else {
    data.message = messageOrDescription;
  }

  return jsonResponse(data, status, {
    'X-Correlation-ID': finalCorrelationId
  }, origin, context);
}
