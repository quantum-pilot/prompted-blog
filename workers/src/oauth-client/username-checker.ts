// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { UserIndexManager } from "./user-index-manager";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { sanitizeError } from "../utils/error-sanitizer";
import { checkUsernameValidity } from "./username-blocklist";
import { UsernameAtomicOps } from "./username-atomic-ops";

export class UsernameChecker {
  private indexManager: UserIndexManager;
  private auditedKV: AuditedKVStore;
  private atomicOps: UsernameAtomicOps;

  constructor(private env: Env) {
    this.indexManager = new UserIndexManager(env);
    this.auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
    this.atomicOps = new UsernameAtomicOps(env);
  }

  private getReservationKey(username: string): string {
    return `username:reserved:${username}`;
  }

  private getUserId(context: RequestContext): string {
    return context.userId || "system";
  }

  async isAvailable(username: string, context: RequestContext): Promise<boolean> {
    if (!username) return false;
    
    // Check blocklist first
    if (checkUsernameValidity(username)) return false;
    
    try {
      const existing = await this.indexManager.getUsernameIndex(username, context);
      if (existing) return false;
      const reserved = await this.auditedKV.get(this.getReservationKey(username), this.getUserId(context));
      return !reserved;
    } catch (error) {
      console.error(sanitizeError(error, "USERNAME_AVAILABILITY_CHECK"));
      return false;
    }
  }

  async reserve(username: string, userId: string, context: RequestContext): Promise<boolean> {
    return this.atomicOps.reserve(username, userId, context);
  }

  async confirmClaim(username: string, userId: string, context: RequestContext): Promise<boolean> {
    return this.atomicOps.confirmClaim(username, userId, context);
  }

  async release(username: string, userId: string, context: RequestContext): Promise<void> {
    return this.atomicOps.release(username, userId, context);
  }
}