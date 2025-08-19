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
  );

export type SessionRouteType = typeof app;
export default app;