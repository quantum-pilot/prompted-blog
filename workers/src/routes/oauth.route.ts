// @agent: cloudflare-backend
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { OAuthAuthorizeRequestSchema, OAuthCallbackRequestSchema } from '../../../shared/contracts';
import { RequestContext } from '../utils/request-context';
import { handleInitiateOAuth } from '../oauth-client/auth-handler';
import { handleCallbackWithParams } from '../oauth-client/callback-handler';
import type { Env } from '../oauth-client/types';
import { HttpStatus } from '../../../shared';
import { setSessionCookie } from '../utils/cookie-manager';
import type { OAuthAuthorizeResponse, OAuthCallbackResponse } from '../../../shared/contracts';
import { processOAuthSuccess } from '../oauth-client/user-integration';

const authError = { error: 'invalid_request', error_description: 'Authentication failed' };

const app = new Hono<{ Bindings: Env }>()
  .get(
    '/oauth/authorize',
    zValidator('query', OAuthAuthorizeRequestSchema, (r, c) => 
      !r.success ? c.json(authError, HttpStatus.BAD_REQUEST) : undefined),
    async (c) => {
      const query = c.req.valid('query');
      const url = new URL(c.req.url);
      url.search = '';
      Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v as string));
      const req = new Request(url.toString(), { method: c.req.method, headers: c.req.raw.headers });
      const ctx = await RequestContext.create(req, c.env);
      const res = await handleInitiateOAuth(c.env, ctx);
      const resData = await res.json() as OAuthAuthorizeResponse;
      return c.json(resData, res.status as any);
    }
  )
  .post(
    '/oauth/callback',
    async (c, next) => {
      const ct = c.req.header('content-type');
      if (!ct?.includes('application/json')) return c.json(authError, HttpStatus.BAD_REQUEST);
      try { await c.req.json(); } catch { return c.json(authError, HttpStatus.BAD_REQUEST); }
      return next();
    },
    zValidator('json', OAuthCallbackRequestSchema, (r, c) => 
      !r.success ? c.json(authError, HttpStatus.BAD_REQUEST) : undefined),
    async (c) => {
      const body = c.req.valid('json');
      const ctx = await RequestContext.create(c.req.raw, c.env);
      const params = {
        code: body.code || null,
        state: body.state || null,
        codeVerifier: body.code_verifier || null,
        provider: body.provider || null,
      };
      
      const res = await handleCallbackWithParams(params, c.env, ctx);
      const data = await res.json() as OAuthCallbackResponse;
      
      // Handle successful OAuth with session cookie
      if (res.status === HttpStatus.OK && data.success && (data as any).session) {
        const processed = await processOAuthSuccess((data as any).session, c.env, ctx);
        const pData = await processed.json() as OAuthCallbackResponse;
        
        if ((pData as any).sessionId) {
          // Set HttpOnly session cookie
          const cookieHdrs = setSessionCookie((pData as any).sessionId, c.env as any);
          const hdrs = new Headers(processed.headers);
          const cookie = cookieHdrs.get('Set-Cookie');
          if (cookie) hdrs.set('Set-Cookie', cookie);
          
          // Keep sessionId in response for backward compatibility (deprecated)
          // The sessionId field will be removed in a future version
          return new Response(JSON.stringify(pData), { status: processed.status, headers: hdrs });
        }
        return c.json(pData, processed.status as any);
      }
      
      return c.json(data, res.status as any);
    }
  );

export type OAuthRouteType = typeof app;
export default app;