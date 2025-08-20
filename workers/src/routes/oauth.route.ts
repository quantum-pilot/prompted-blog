// @agent: cloudflare-backend
/**
 * OAuth routes using Hono and Zod contracts
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import {
  OAuthAuthorizeRequestSchema,
  OAuthCallbackRequestSchema,
  OAuthAuthorizeErrorSchema,
  OAuthCallbackErrorSchema,
  type OAuthAuthorizeResponse,
  type OAuthCallbackResponse,
} from '../../../shared/contracts';
import type { z } from 'zod';

type OAuthAuthorizeError = z.infer<typeof OAuthAuthorizeErrorSchema>;
type OAuthCallbackError = z.infer<typeof OAuthCallbackErrorSchema>;
import { RequestContext } from '../utils/request-context';
import { handleInitiateOAuth } from '../oauth-client/auth-handler';
import { handleCallbackWithParams } from '../oauth-client/callback-handler';
import type { Env } from '../oauth-client/types';
import { HttpStatus } from '../../../shared';

const app = new Hono<{ Bindings: Env }>()
  .get(
    '/oauth/authorize',
    zValidator('query', OAuthAuthorizeRequestSchema, (result, c) => {
      if (!result.success) {
        // Always return 'Authentication failed' for security
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
      const query = c.req.valid('query');
      
      // Create a new request with validated query params for the handlers
      const url = new URL(c.req.url);
      url.search = ''; // Clear existing params
      Object.entries(query).forEach(([key, value]) => {
        url.searchParams.set(key, value as string);
      });
      
      const newRequest = new Request(url.toString(), {
        method: c.req.method,
        headers: c.req.raw.headers,
      });
      
      const context = await RequestContext.create(newRequest, c.env);
      const response = await handleInitiateOAuth(c.env, context);
      const data = await response.json() as OAuthAuthorizeResponse;
      
      return c.json(data, response.status as any);
    }
  )
  .post(
    '/oauth/callback',
    async (c, next) => {
      // Check if content-type is JSON
      const contentType = c.req.header('content-type');
      if (!contentType?.includes('application/json')) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Authentication failed',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      // Try to parse JSON body
      try {
        await c.req.json();
      } catch (e) {
        return c.json(
          {
            error: 'invalid_request',
            error_description: 'Authentication failed',
          },
          HttpStatus.BAD_REQUEST
        );
      }
      
      return next();
    },
    zValidator('json', OAuthCallbackRequestSchema, (result, c) => {
      if (!result.success) {
        // Always return 'Authentication failed' for security
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
      const body = c.req.valid('json');
      
      // Create context from original request
      const context = await RequestContext.create(c.req.raw, c.env);
      
      // Pass the validated and parsed params directly
      const params = {
        code: body.code || null,
        state: body.state || null,
        codeVerifier: body.code_verifier || null,
        provider: body.provider || null,
      };
      
      const response = await handleCallbackWithParams(params, c.env, context);
      const data = await response.json() as OAuthCallbackResponse;
      
      return c.json(data, response.status as any);
    }
  );

export type OAuthRouteType = typeof app;
export default app;