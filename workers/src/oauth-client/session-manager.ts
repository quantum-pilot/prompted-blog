// @agent: cloudflare-backend
/**
 * Session management for OAuth with KV storage
 */

import type { Env } from './types';
import type { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

export interface SessionData {
  id: string;
  provider: string;
  userId: string;
  email: string;
  name?: string;
  picture?: string;
  createdAt: number;
  expiresAt: number;
  state?: string;
}

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

/**
 * Validates that a session ID matches the expected format.
 * Session IDs are base64url encoded, 43-44 chars long.
 */
function isValidSessionId(sessionId: string): boolean {
  const sessionIdPattern = /^[A-Za-z0-9_-]{43,44}$/;
  return sessionIdPattern.test(sessionId);
}

/**
 * Validates that a state parameter is safe to use as a KV key suffix.
 * States should be alphanumeric with hyphens and underscores, max 128 chars.
 */
function isValidStateParameter(state: string): boolean {
  const statePattern = /^[A-Za-z0-9_-]{1,128}$/;
  return statePattern.test(state);
}

export class SessionManager {
  constructor(private env: Env) {}

  async createSession(data: Omit<SessionData, 'id' | 'createdAt'>): Promise<string> {
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const sessionId = btoa(String.fromCharCode(...Array.from(tokenBytes)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    
    const session: SessionData = { ...data, id: sessionId, createdAt: Date.now() };
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    const effectiveTtl = Math.min(ttl, SESSION_TTL);

    // Store session data directly (consider adding encryption in production)
    await this.env.OAUTH_SESSIONS.put(
      `session:${sessionId}`,
      JSON.stringify(session),
      { expirationTtl: effectiveTtl }
    );
    return sessionId;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    // Validate session ID format before querying KV
    if (!isValidSessionId(sessionId)) {
      console.error('Invalid session ID format:', { length: sessionId.length });
      return null;
    }

    const data = await this.env.OAUTH_SESSIONS.get(`session:${sessionId}`);
    if (!data) return null;

    try {
      const session: SessionData = JSON.parse(data);
      
      if (session.expiresAt < Date.now()) {
        await this.deleteSession(sessionId);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Failed to parse session:', error);
      await this.deleteSession(sessionId);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    // Validate session ID format before deletion
    if (!isValidSessionId(sessionId)) {
      console.error('Invalid session ID format for deletion:', { length: sessionId.length });
      return;
    }
    await this.env.OAUTH_SESSIONS.delete(`session:${sessionId}`);
  }

  async validateSession(
    sessionId: string,
    context: RequestContext
  ): Promise<SessionData | null> {
    // Validate session ID format first
    if (!isValidSessionId(sessionId)) {
      context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
        reason: 'Invalid session ID format',
        sessionIdLength: sessionId.length
      });
      return null;
    }

    const session = await this.getSession(sessionId);
    
    if (!session) {
      context.log(AuditEventType.AUTH_SESSION_INVALID, 'failure', {
        sessionId,
        reason: 'Session not found or expired'
      });
      return null;
    }

    context.log(AuditEventType.AUTH_SESSION_VALIDATED, 'success', {
      sessionId,
      userId: session.userId
    });

    // Enrich context with session data
    context.userId = session.userId;
    context.userEmail = session.email;
    context.sessionId = sessionId;

    return session;
  }

  async storeOAuthState(state: string, data: any, ttl = 600): Promise<void> {
    // Validate state parameter format before storing
    if (!isValidStateParameter(state)) {
      console.error('Invalid state parameter format for storage:', { length: state.length });
      throw new Error('Invalid state parameter format');
    }
    // Store state data directly (consider adding encryption in production)
    await this.env.OAUTH_SESSIONS.put(
      `state:${state}`,
      JSON.stringify(data),
      { expirationTtl: ttl }
    );
  }

  async getOAuthState(state: string): Promise<any | null> {
    // Validate state parameter format before querying
    if (!isValidStateParameter(state)) {
      console.error('Invalid state parameter format for retrieval:', { length: state.length });
      return null;
    }
    
    const data = await this.env.OAUTH_SESSIONS.get(`state:${state}`);
    if (!data) return null;
    
    try {
      const stateData = JSON.parse(data);
      await this.env.OAUTH_SESSIONS.delete(`state:${state}`);
      return stateData;
    } catch (error) {
      console.error('Failed to parse OAuth state:', error);
      await this.env.OAUTH_SESSIONS.delete(`state:${state}`);
      return null;
    }
  }
}