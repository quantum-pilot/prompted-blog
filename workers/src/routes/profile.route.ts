// @agent: cloudflare-backend
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { UsernameSchema } from '../../../shared/contracts';
import { RequestContext } from '../utils/request-context';
import { ProfileHandler } from '../oauth-client/profile-handler';
import { RateLimiter } from '../utils/rate-limiter';
import type { Env } from '../oauth-client/types';
import { HttpStatus } from '../../../shared';

const app = new Hono<{ Bindings: Env; Variables: { userId?: string; userEmail?: string; context?: RequestContext; }; }>()
  .get('/api/profile', async (c) => {
    const userId = c.get('userId');
    if (!userId) return c.json({ error: 'unauthorized', error_description: 'Authentication required' }, HttpStatus.UNAUTHORIZED);
    
    // Rate limiting: 60 requests per minute for authenticated profile reads
    const rateLimiter = new RateLimiter({
      kv: c.env.OAUTH_SESSIONS,
      limit: 60,
      windowMs: 60000,
      keyPrefix: 'rl:profile:get'
    });
    
    if (!(await rateLimiter.isAllowed(userId))) {
      return c.json({ error: 'rate_limit', error_description: 'Too many requests' }, 429);
    }
    
    const context = c.get('context') || await RequestContext.create(c.req.raw, c.env);
    const handler = new ProfileHandler(c.env);
    const response = await handler.getProfile(userId, context);
    
    const status = response.success ? HttpStatus.OK 
      : (!response.success && response.error === 'user_not_found') ? HttpStatus.NOT_FOUND : HttpStatus.INTERNAL_SERVER_ERROR;
    return c.json(response, status);
  })
  .put('/api/profile',
    zValidator('json', z.object({ username: UsernameSchema }), (result, c) => {
      if (!result.success) return c.json({ error: 'invalid_request', 
        error_description: result.error.issues[0]?.message || 'Invalid username format' }, HttpStatus.BAD_REQUEST);
    }),
    async (c) => {
      const userId = c.get('userId');
      if (!userId) return c.json({ error: 'unauthorized', error_description: 'Authentication required' }, HttpStatus.UNAUTHORIZED);
      
      // Strict rate limiting: 5 username updates per hour
      const rateLimiter = new RateLimiter({
        kv: c.env.OAUTH_SESSIONS,
        limit: 5,
        windowMs: 3600000, // 1 hour
        keyPrefix: 'rl:profile:update'
      });
      
      if (!(await rateLimiter.isAllowed(userId))) {
        return c.json({ error: 'rate_limit', error_description: 'Too many username update attempts' }, 429);
      }
      
      const { username } = c.req.valid('json');
      const context = c.get('context') || await RequestContext.create(c.req.raw, c.env);
      const handler = new ProfileHandler(c.env);
      const response = await handler.updateProfile({ id: userId, username }, context);
      
      const status = response.success ? HttpStatus.OK
        : (!response.success && response.error === 'username_taken') ? HttpStatus.CONFLICT
        : (!response.success && response.error === 'username_invalid') ? HttpStatus.BAD_REQUEST
        : HttpStatus.INTERNAL_SERVER_ERROR;
      
      return c.json(response, status);
    })
  .get('/api/username/check/:username', async (c) => {
    // Aggressive rate limiting for public endpoint: 10 checks per minute per IP
    const clientIp = RateLimiter.getClientIp(c.req.raw);
    const rateLimiter = new RateLimiter({
      kv: c.env.OAUTH_SESSIONS,
      limit: 10,
      windowMs: 60000, // 1 minute
      keyPrefix: 'rl:username:check'
    });
    
    if (!(await rateLimiter.isAllowed(clientIp))) {
      return c.json({ error: 'rate_limit', error_description: 'Too many requests' }, 429);
    }
    
    const username = c.req.param('username');
    const context = await RequestContext.create(c.req.raw, c.env);
    const handler = new ProfileHandler(c.env);
    const response = await handler.checkUsernameAvailability({ username }, context);
    
    const status = response.success ? HttpStatus.OK
      : (!response.success && response.error === 'username_invalid') ? HttpStatus.BAD_REQUEST : HttpStatus.INTERNAL_SERVER_ERROR;
    
    return c.json(response, status);
  });

export type ProfileRouteType = typeof app;
export default app;