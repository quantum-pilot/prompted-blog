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
  .get(
    '/oauth/callback',
    async (c) => {
      // Get parameters from URL
      const url = new URL(c.req.url);
      const state = url.searchParams.get('state');
      
      // Look up the stored PKCE verifier from KV store using the state
      let codeVerifier = '';
      if (state && c.env.OAUTH_SESSIONS) {
        try {
          const stored = await c.env.OAUTH_SESSIONS.get(`pkce:${state}`);
          if (stored) {
            const data = JSON.parse(stored);
            codeVerifier = data.codeVerifier || '';
            console.log('Retrieved PKCE data:', { state, hasVerifier: !!data.codeVerifier });
          } else {
            console.log('No PKCE data found for state:', state);
          }
        } catch (e) {
          console.error('Failed to retrieve PKCE verifier:', e);
        }
      }
      
      // Simple HTML form that auto-submits with all required data
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Completing sign in...</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              text-align: center;
            }
            button {
              background: #3498db;
              color: white;
              border: none;
              padding: 12px 24px;
              font-size: 16px;
              border-radius: 4px;
              cursor: pointer;
            }
            button:hover {
              background: #2980b9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Completing sign in...</h2>
            <form id="callbackForm" method="POST" action="/oauth/callback">
              ${Array.from(url.searchParams.entries())
                .map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`)
                .join('\n              ')}
              <input type="hidden" name="code_verifier" value="${codeVerifier}">
              <input type="hidden" name="provider" value="google">
              <button type="submit" id="submitBtn">Click here if not redirected</button>
            </form>
          </div>
          <script>
            // Auto-submit the form immediately
            document.getElementById('callbackForm').submit();
          </script>
        </body>
        </html>
      `;
      
      // Set CSP header to allow inline script
      const headers = new Headers();
      headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline';`);
      headers.set('Content-Type', 'text/html; charset=UTF-8');
      
      return new Response(html, {
        status: 200,
        headers
      });
    }
  )
  .post(
    '/oauth/callback',
    async (c) => {
      const ct = c.req.header('content-type');
      let body: any;
      
      // Handle both JSON and form data
      if (ct?.includes('application/json')) {
        try {
          body = await c.req.json();
        } catch {
          return c.json(authError, HttpStatus.BAD_REQUEST);
        }
      } else if (ct?.includes('application/x-www-form-urlencoded')) {
        // Handle form POST
        const formData = await c.req.parseBody();
        body = {
          code: formData.code,
          state: formData.state,
          code_verifier: formData.code_verifier,
          provider: formData.provider,
        };
      } else {
        return c.json(authError, HttpStatus.BAD_REQUEST);
      }
      
      const ctx = await RequestContext.create(c.req.raw, c.env);
      const params = {
        code: body.code || null,
        state: body.state || null,
        codeVerifier: body.code_verifier || null,
        provider: body.provider || null,
      };
      
      const res = await handleCallbackWithParams(params, c.env, ctx);
      const data = await res.json() as OAuthCallbackResponse;
      
      console.log('OAuth callback response:', { status: res.status, success: data.success, hasSession: !!(data as any).session, hasSessionId: !!(data as any).sessionId, data });
      
      // Handle successful OAuth with session cookie
      // Check if we already have a sessionId (already processed) or need to process
      if (res.status === HttpStatus.OK && data.success) {
        let sessionId = (data as any).sessionId;
        let responseData = data;
        
        // If we have a session object but no sessionId, process it
        if (!sessionId && (data as any).session) {
          const processed = await processOAuthSuccess((data as any).session, c.env, ctx);
          responseData = await processed.json() as OAuthCallbackResponse;
          sessionId = (responseData as any).sessionId;
          console.log('Processed OAuth result:', { hasSessionId: !!sessionId, sessionId });
        }
        
        if (sessionId) {
          // Set HttpOnly session cookie
          const cookieHdrs = setSessionCookie(sessionId, c.env as any);
          const hdrs = new Headers();
          const cookie = cookieHdrs.get('Set-Cookie');
          if (cookie) hdrs.set('Set-Cookie', cookie);
          
          // If this was a form POST, redirect to home page
          if (ct?.includes('application/x-www-form-urlencoded')) {
            hdrs.set('Location', '/');
            return new Response(null, { status: 303, headers: hdrs });
          }
          
          // For JSON requests, return the response
          hdrs.set('Content-Type', 'application/json');
          return new Response(JSON.stringify(responseData), { status: 200, headers: hdrs });
        }
        return c.json(responseData, 200);
      }
      
      // Handle errors
      if (ct?.includes('application/x-www-form-urlencoded')) {
        // For form POST, redirect to home with error
        return c.redirect('/?error=oauth_failed', 303);
      }
      
      return c.json(data, res.status as any);
    }
  );

export type OAuthRouteType = typeof app;
export default app;