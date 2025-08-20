// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { sanitizeError } from "../utils/error-sanitizer";

const USER_TTL = 30 * 24 * 60 * 60;

export class UserIndexManager {
  private auditedKV: AuditedKVStore;
  
  constructor(env: Env) {
    this.auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  }

  async setEmailIndex(email: string, userId: string, context: RequestContext): Promise<void> {
    await this.auditedKV.put(
      `user:email:${email}`,
      userId,
      context.userId || "system",
      { expirationTtl: USER_TTL }
    );
  }

  async getEmailIndex(email: string, context: RequestContext): Promise<string | null> {
    return await this.auditedKV.get(
      `user:email:${email}`,
      context.userId || "system"
    );
  }

  async deleteEmailIndex(email: string, context: RequestContext): Promise<void> {
    await this.auditedKV.delete(
      `user:email:${email}`,
      context.userId || "system"
    );
  }

  async setUsernameIndex(username: string, userId: string, context: RequestContext): Promise<void> {
    await this.auditedKV.put(
      `user:username:${username}`,
      userId,
      context.userId || "system",
      { expirationTtl: USER_TTL }
    );
  }

  async getUsernameIndex(username: string, context: RequestContext): Promise<string | null> {
    return await this.auditedKV.get(
      `user:username:${username}`,
      context.userId || "system"
    );
  }

  async deleteUsernameIndex(username: string, context: RequestContext): Promise<void> {
    await this.auditedKV.delete(
      `user:username:${username}`,
      context.userId || "system"
    );
  }

  async checkUsernameAvailable(username: string, context: RequestContext): Promise<boolean> {
    if (!username) return false;
    try {
      const userId = await this.getUsernameIndex(username, context);
      return !userId; // Available if no user ID found
    } catch (error) {
      console.error(sanitizeError(error, "CHECK_USERNAME_AVAILABILITY"));
      return false;
    }
  }

  async setUserData(userId: string, data: string, context: RequestContext): Promise<void> {
    await this.auditedKV.put(
      `user:id:${userId}`,
      data,
      context.userId || "system",
      { expirationTtl: USER_TTL }
    );
  }

  async getUserData(userId: string, context: RequestContext): Promise<string | null> {
    return await this.auditedKV.get(
      `user:id:${userId}`,
      context.userId || "system"
    );
  }

  async deleteUserData(userId: string, context: RequestContext): Promise<void> {
    await this.auditedKV.delete(
      `user:id:${userId}`,
      context.userId || "system"
    );
  }
}