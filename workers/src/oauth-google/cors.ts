// @agent: cloudflare-backend
// CORS headers configuration and handling

// Whitelist of allowed origins
const ALLOWED_ORIGINS = [
  'https://promptedblog.com',
  'http://localhost:8000', // for development
];

/**
 * Get CORS headers for a given origin
 * @param origin - The origin from the request
 * @returns CORS headers if origin is allowed, empty object otherwise
 */
export function getCorsHeaders(origin: string | null): HeadersInit {
  // If no origin or origin not in whitelist, return no CORS headers
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
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

export function handleCorsOptions(request: Request): Response {
  const origin = request.headers.get('Origin');
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(origin),
  });
}

export function addCorsHeaders(headers: HeadersInit = {}, origin: string | null): HeadersInit {
  return {
    ...headers,
    ...getCorsHeaders(origin),
  };
}

export function jsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: HeadersInit = {},
  origin: string | null = null
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json',
      ...additionalHeaders,
    }, origin),
  });
}

export function errorResponse(
  error: string,
  messageOrDescription: string,
  status: number = 500,
  origin: string | null = null
): Response {
  console.error(`OAuth Error: ${error} - ${messageOrDescription}`);
  // Support both 'message' and 'error_description' fields
  const data: any = { error };
  if (error === 'access_denied' || error === 'invalid_grant') {
    data.error_description = messageOrDescription;
  } else {
    data.message = messageOrDescription;
  }
  return jsonResponse(data, status, {}, origin);
}
