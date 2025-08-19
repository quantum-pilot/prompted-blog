// @agent: cloudflare-backend
/**
 * Session management for OAuth with KV storage
 */

import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { AuditEventType } from "../utils/audit-logger";
import { SessionStorage } from "./session-storage";
import { isValidSessionId } from "./session-validation";
import type { OAuthSession } from "../../../shared";

// Extend OAuthSession with worker-specific fields
export interface SessionData extends OAuthSession {
  id: string;
  userId: string; // Unique user identifier
  provider: 'google' | 'github';
  createdAt: number;
  state: string;
}

export class SessionManager {
  private storage: SessionStorage;

  constructor(private env: Env) {
    this.storage = new SessionStorage(env);
  }

  async createSession(
    data: Omit<SessionData, "id" | "createdAt">,
    context: RequestContext
  ): Promise<string> {
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const sessionId = btoa(String.fromCharCode(...Array.from(tokenBytes)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const session: SessionData = {
      ...data,
      id: sessionId,
      createdAt: Date.now(),
    };
    const ttl = Math.floor((session.expiresAt - Date.now()) / 1000);
    await this.storage.storeSession(session, ttl, context);
    return sessionId;
  }

  async getSession(
    sessionId: string,
    context: RequestContext
  ): Promise<SessionData | null> {
    const session = await this.storage.retrieveSession(sessionId, context);
    if (session && session.expiresAt < Date.now()) {
      await this.deleteSession(sessionId, context);
      return null;
    }
    return session;
  }

  async deleteSession(
    sessionId: string,
    context: RequestContext
  ): Promise<void> {
    await this.storage.removeSession(sessionId, context);
  }

  async validateSession(
    sessionId: string,
    context: RequestContext
  ): Promise<SessionData | null> {
    // Validate session ID format first
    if (!isValidSessionId(sessionId)) {
      context.log(AuditEventType.AUTH_SESSION_INVALID, "failure", {
        reason: "Invalid session ID format",
        sessionIdLength: sessionId.length,
      });
      return null;
    }

    const session = await this.getSession(sessionId, context);

    if (!session) {
      context.log(AuditEventType.AUTH_SESSION_INVALID, "failure", {
        sessionId,
        reason: "Session not found or expired",
      });
      return null;
    }

    context.log(AuditEventType.AUTH_SESSION_VALIDATED, "success", {
      sessionId,
      userId: session.userId,
    });

    // Enrich context with session data
    context.userId = session.userId;
    context.userEmail = session.email;
    context.sessionId = sessionId;

    return session;
  }

  async storeOAuthState(
    state: string,
    data: any,
    context: RequestContext,
    ttl = 600
  ): Promise<void> {
    await this.storage.storeOAuthState(state, data, context, ttl);
  }

  async getOAuthState(
    state: string,
    context: RequestContext
  ): Promise<any | null> {
    return await this.storage.retrieveOAuthState(state, context);
  }
}
