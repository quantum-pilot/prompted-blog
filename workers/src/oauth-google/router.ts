// @agent: cloudflare-backend
// Request routing
import type { Env } from './types';
import { handleOAuthStart, handleOAuthCallback } from './handlers';
import { handleCorsOptions, errorResponse } from './cors';

export default async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');

  // Handle CORS preflight - also handled at worker level for redundancy
  if (request.method === 'OPTIONS') {
    return handleCorsOptions(request);
  }

  // Route handling
  switch (url.pathname) {
    case '/oauth/google/start':
      return handleOAuthStart(env, origin);

    case '/oauth/google/callback':
      return handleOAuthCallback(url, env, origin);

    default:
      return errorResponse('not_found', 'Route not found', 404, origin);
  }
}
