// CORS headers configuration and handling

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function handleCorsOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function addCorsHeaders(headers: HeadersInit = {}): HeadersInit {
  return {
    ...headers,
    ...corsHeaders,
  };
}

export function jsonResponse(
  data: any,
  status: number = 200,
  additionalHeaders: HeadersInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: addCorsHeaders({
      'Content-Type': 'application/json',
      ...additionalHeaders,
    }),
  });
}

export function errorResponse(
  error: string,
  messageOrDescription: string,
  status: number = 500
): Response {
  console.error(`OAuth Error: ${error} - ${messageOrDescription}`);
  // Support both 'message' and 'error_description' fields
  const data: any = { error };
  if (error === 'access_denied' || error === 'invalid_grant') {
    data.error_description = messageOrDescription;
  } else {
    data.message = messageOrDescription;
  }
  return jsonResponse(data, status);
}