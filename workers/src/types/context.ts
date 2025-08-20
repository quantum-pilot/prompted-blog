// @agent: cloudflare-backend
/**
 * Context types for Hono middleware
 */

import type { SessionData } from '../oauth-client/session-manager';
import type { RequestContext } from '../utils/request-context';

export interface AuthContext {
  Variables: {
    userId: string;
    userEmail: string;
    sessionId: string;
    session: SessionData;
    context: RequestContext;
  };
}