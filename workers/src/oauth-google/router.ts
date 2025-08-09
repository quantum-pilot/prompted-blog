// Request routing
import type { Env } from './types';
import { handleOAuthStart, handleOAuthCallback } from './handlers';
import { handleCorsOptions, errorResponse } from './cors';

export default async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return handleCorsOptions();
  }

  // Route handling
  switch (url.pathname) {
    case '/oauth/google/start':
      return handleOAuthStart(env);

    case '/oauth/google/callback':
      return handleOAuthCallback(url, env);

    default:
      return errorResponse('not_found', 'Route not found', 404);
  }
}