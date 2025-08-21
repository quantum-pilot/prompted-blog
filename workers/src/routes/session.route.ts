// @agent: cloudflare-backend
/**
 * Session routes using Hono
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  BearerTokenSchema,
  type SessionValidationResponse,
} from '../../../shared/contracts';
import { RequestContext } from '../utils/request-context';
import { handleSessionGet } from '../oauth-client/session-handler';
import type { Env } from '../oauth-client/types';
import { HttpStatus } from '../../../shared';
import { getSessionFromCookie, clearSessionCookie } from '../utils/cookie-manager';
import { SessionManager } from '../oauth-client/session-manager';

// Schema for Authorization header
const AuthHeaderSchema = z.object({
  authorization: BearerTokenSchema,
});

const app = new Hono<{ Bindings: Env }>()
  .get(
    '/oauth/session',
    zValidator('header', AuthHeaderSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Authentication failed',
          },
          HttpStatus.BAD_REQUEST
        );
      }
    }),
    async (c) => {
      const headers = c.req.valid('header');
      
      // Create a new request with the validated headers
      const newHeaders = new Headers(c.req.raw.headers);
      newHeaders.set('Authorization', headers.authorization);
      
      const newRequest = new Request(c.req.url, {
        method: 'GET',
        headers: newHeaders,
      });
      
      const context = await RequestContext.create(newRequest, c.env);
      const response = await handleSessionGet(c.env, context);
      const data = await response.json() as SessionValidationResponse;
      
      return c.json(data, response.status as any);
    }
  )
  .post('/oauth/logout', async (c) => {
    try {
      // Create request context
      const context = await RequestContext.create(c.req.raw, c.env);
      
      // Extract session from cookie if present
      const sessionId = getSessionFromCookie(c.req.raw);
      
      // If session exists, delete it from KV
      if (sessionId) {
        const sessionManager = new SessionManager(c.env);
        await sessionManager.deleteSession(sessionId, context);
      }
      
      // Clear the session cookie
      const clearCookieHeaders = clearSessionCookie();
      
      // Return success response (always success to prevent information leakage)
      return c.json(
        { success: true, message: 'Logged out successfully' },
        HttpStatus.OK,
        { 'Set-Cookie': clearCookieHeaders.get('Set-Cookie') || '' }
      );
    } catch (error) {
      // Always return success to prevent information leakage
      const clearCookieHeaders = clearSessionCookie();
      return c.json(
        { success: true, message: 'Logged out successfully' },
        HttpStatus.OK,
        { 'Set-Cookie': clearCookieHeaders.get('Set-Cookie') || '' }
      );
    }
  });

export type SessionRouteType = typeof app;
export default app;