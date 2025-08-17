// @agent: cloudflare-backend
/**
 * Storage operations for OAuth sessions and state
 */

import type { Env } from "./types";
import type { SessionData } from "./session-manager";
import type { RequestContext } from "../utils/request-context";
import { SessionEncryption } from "./session-encryption";
import { isValidSessionId, isValidStateParameter } from "./session-validation";
import { AuditedKVStore } from "../utils/audit-kvstore";

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

export class SessionStorage {
  private encryption: SessionEncryption;
  private auditedKV: AuditedKVStore;

  constructor(private env: Env) {
    this.encryption = new SessionEncryption(env);
    this.auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  }

  async storeSession(
    session: SessionData,
    ttl: number,
    context: RequestContext
  ): Promise<void> {
    const effectiveTtl = Math.min(ttl, SESSION_TTL);
    const encryptedData = await this.encryption.encrypt(
      JSON.stringify(session)
    );

    await this.auditedKV.put(
      `session:${session.id}`,
      encryptedData,
      context.userId || "anonymous",
      { expirationTtl: effectiveTtl }
    );
  }

  async retrieveSession(
    sessionId: string,
    context: RequestContext
  ): Promise<SessionData | null> {
    if (!isValidSessionId(sessionId)) {
      console.error("Invalid session ID format:", { length: sessionId.length });
      return null;
    }

    const encryptedData = await this.auditedKV.get(
      `session:${sessionId}`,
      context.userId || "anonymous"
    );
    if (!encryptedData) return null;

    try {
      const decryptedData = await this.encryption.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error("Failed to parse session:", error);
      return null;
    }
  }

  async removeSession(
    sessionId: string,
    context: RequestContext
  ): Promise<void> {
    if (!isValidSessionId(sessionId)) {
      console.error("Invalid session ID format for deletion:", {
        length: sessionId.length,
      });
      return;
    }
    await this.auditedKV.delete(
      `session:${sessionId}`,
      context.userId || "anonymous"
    );
  }

  async storeOAuthState(
    state: string,
    data: any,
    context: RequestContext,
    ttl = 600
  ): Promise<void> {
    if (!isValidStateParameter(state)) {
      console.error("Invalid state parameter format for storage:", {
        length: state.length,
      });
      throw new Error("Invalid state parameter format");
    }

    const encryptedData = await this.encryption.encrypt(JSON.stringify(data));
    await this.auditedKV.put(
      `state:${state}`,
      encryptedData,
      context.userId || "anonymous",
      { expirationTtl: ttl }
    );
  }

  async retrieveOAuthState(
    state: string,
    context: RequestContext
  ): Promise<any | null> {
    if (!isValidStateParameter(state)) {
      console.error("Invalid state parameter format for retrieval:", {
        length: state.length,
      });
      return null;
    }

    const encryptedData = await this.auditedKV.get(
      `state:${state}`,
      context.userId || "anonymous"
    );
    if (!encryptedData) return null;

    try {
      const decryptedData = await this.encryption.decrypt(encryptedData);
      const stateData = JSON.parse(decryptedData);
      await this.auditedKV.delete(
        `state:${state}`,
        context.userId || "anonymous"
      );
      return stateData;
    } catch (error) {
      console.error("Failed to parse OAuth state:", error);
      await this.auditedKV.delete(
        `state:${state}`,
        context.userId || "anonymous"
      );
      return null;
    }
  }
}
