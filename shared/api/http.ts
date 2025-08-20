/**
 * HTTP Utilities
 * Shared HTTP constants, status codes, and header builders
 */

/** HTTP methods */
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
  OPTIONS = "OPTIONS",
}

/** Content types */
export enum ContentType {
  JSON = "application/json",
  FORM_URLENCODED = "application/x-www-form-urlencoded",
  TEXT = "text/plain",
  HTML = "text/html",
}

/** HTTP status codes */
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  FOUND = 302,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * Build API headers with common defaults
 */
export function buildApiHeaders(options?: {
  contentType?: ContentType;
  authorization?: string;
  additionalHeaders?: Record<string, string>;
}): Headers {
  const headers = new Headers();
  headers.set("Content-Type", options?.contentType || ContentType.JSON);
  headers.set("Accept", ContentType.JSON);

  if (options?.authorization) {
    headers.set("Authorization", options.authorization);
  }

  if (options?.additionalHeaders) {
    Object.entries(options.additionalHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return headers;
}

/**
 * Build security headers for responses
 */
export function buildSecurityHeaders(options?: {
  csp?: string;
  frameOptions?: "DENY" | "SAMEORIGIN";
}): Record<string, string> {
  const csp =
    options?.csp ||
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": options?.frameOptions || "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": csp,
  };
}

/** Build CORS headers for responses */
export function buildCorsHeaders(options: {
  origin: string;
  credentials?: boolean;
  methods?: string[];
  headers?: string[];
}): Record<string, string> {
  const result: Record<string, string> = {
    "Access-Control-Allow-Origin": options.origin,
    "Access-Control-Allow-Methods":
      options.methods?.join(", ") || "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      options.headers?.join(", ") || "Content-Type, Authorization",
  };
  if (options.credentials) {
    result["Access-Control-Allow-Credentials"] = "true";
  }
  return result;
}
