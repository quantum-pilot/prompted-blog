// @agent: cloudflare-backend
/**
 * OAuth Provider Router - handles OAuth and application endpoints
 * Acts as defaultHandler for @cloudflare/workers-oauth-provider
 */
import type { OAuthEnvironment } from './handlers';
import { ensureClientRegistered, completeOAuthAuthorization } from './handlers';
import { handleCorsOptions, errorResponse, getCorsHeaders } from './cors';
import { AuditEventType } from '../utils/audit-logger';
import { RequestContext } from '../utils/request-context';

/**
 * Main router function that acts as defaultHandler for OAuthProvider
 */
export default {
  async fetch(request: Request, env: any, ctx?: any): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const context = await RequestContext.create(request, env);

    try {
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS') {
        return handleCorsOptions(context);
      }

      // Ensure OAuth client is registered
      await ensureClientRegistered(env);

      // Route requests
      switch (url.pathname) {
        case '/authorize':
          return handleAuthorizeEndpoint(request, env, context);

        case '/auth/start':
          // Redirect to the OAuth authorize endpoint
          const authorizeUrl = new URL('/authorize', request.url);
          authorizeUrl.searchParams.set('client_id', env.CLIENT_ID);
          authorizeUrl.searchParams.set('response_type', 'code');
          authorizeUrl.searchParams.set('redirect_uri', env.REDIRECT_URI);
          authorizeUrl.searchParams.set('scope', 'openid email profile');
          return Response.redirect(authorizeUrl.toString(), 302);

        case '/auth/callback':
          // Application callback success page
          return new Response(JSON.stringify({
            success: true,
            message: 'OAuth authorization completed'
          }), {
            headers: {
              'Content-Type': 'application/json',
              'X-Correlation-ID': context.correlationId,
              ...getCorsHeaders(origin, context)
            }
          });

        default:
          context.log(AuditEventType.ROUTE_NOT_FOUND, 'failure', {
            path: url.pathname,
            method: request.method,
            origin: origin || 'none',
            reason: 'Unknown route accessed'
          });

          return errorResponse('not_found', 'Route not found', 404, origin, context);
      }
    } catch (error) {
      console.error('Router error:', error);
      context.log(AuditEventType.REQUEST_ERROR, 'failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: url.pathname,
        method: request.method
      });

      return errorResponse(
        'internal_error',
        'An unexpected error occurred',
        500,
        origin,
        context
      );
    }
  }
};

/**
 * Handles the OAuth /authorize endpoint using OAuthProvider helpers
 */
async function handleAuthorizeEndpoint(
  request: Request,
  env: OAuthEnvironment,
  context: RequestContext
): Promise<Response> {
  const oauthReqInfo = await env.OAUTH_PROVIDER.parseAuthRequest(request);
  await env.OAUTH_PROVIDER.lookupClient(oauthReqInfo.clientId);

  const redirectTo = await completeOAuthAuthorization(oauthReqInfo, env);

  context.log(AuditEventType.AUTH_FLOW_INITIATED, 'success', {
    clientId: oauthReqInfo.clientId,
    scope: oauthReqInfo.scope,
    responseType: oauthReqInfo.responseType
  });

  return Response.redirect(redirectTo, 302);
}
