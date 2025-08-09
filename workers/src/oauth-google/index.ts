// Main entry point for OAuth Google Worker
import type { Env } from './types';
import router from './router';
import { handleCorsOptions, getCorsHeaders } from './cors';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // Extract origin early for CORS handling
      const origin = request.headers.get('Origin');

      // Handle OPTIONS requests at worker level for all paths
      if (request.method === 'OPTIONS') {
        return handleCorsOptions(request);
      }

      // Route all other requests
      return await router(request, env);
    } catch (error) {
      // Ensure CORS headers are included even in error responses
      const origin = request.headers.get('Origin');
      console.error('Worker error:', error);

      return new Response(
        JSON.stringify({
          error: 'internal_error',
          message: 'An unexpected error occurred'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders(origin),
          },
        }
      );
    }
  },
};
