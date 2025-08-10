// @agent: cloudflare-backend
// OAuth Google Worker using @cloudflare/workers-oauth-provider
import { OAuthProvider } from '@cloudflare/workers-oauth-provider';
import { getCorsHeaders } from './cors';
import { googleOAuthConfig } from './config';
import defaultHandler from './router';

const apiHandler = {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (url.pathname === '/api/profile') {
      return new Response(JSON.stringify({
        success: true,
        user: {
          provider: ctx.props?.provider || 'google',
          clientId: ctx.props?.clientId,
          email: ctx.props?.email || 'unknown'
        }
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      });
    }

    if (url.pathname === '/api/whoami') {
      return new Response(JSON.stringify({
        authenticated: true,
        provider: ctx.props?.provider || 'google',
        email: ctx.props?.email || 'unknown',
        clientId: ctx.props?.clientId
      }), {
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(origin)
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'not_found',
      message: 'API endpoint not found'
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(origin)
      }
    });
  }
};

export default new OAuthProvider({
  apiRoute: ['/api/'],
  apiHandler,
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  scopesSupported: googleOAuthConfig.scopes
});
