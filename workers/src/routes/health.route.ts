// @agent: cloudflare-backend
/**
 * Health check route using Hono
 */

import { Hono } from 'hono';
import {
  type HealthCheckResponse,
} from '../../../shared/contracts';
import { HttpStatus } from '../../../shared';
import type { Env } from '../oauth-client/types';

const app = new Hono<{ Bindings: Env }>()
  .get('/health', async (c) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: Date.now(),
    };
    
    return c.json(response, HttpStatus.OK);
  });

export type HealthRouteType = typeof app;
export default app;