// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { UserIndexManager } from "./user-index-manager";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { sanitizeError } from "../utils/error-sanitizer";
import { UsernameBlocklist } from "./username-blocklist";

const RESERVATION_TTL = 90; // 90 seconds TTL for username reservations

export class UsernameAtomicOps {
  private indexManager: UserIndexManager;
  private auditedKV: AuditedKVStore;

  constructor(private env: Env) {
    this.indexManager = new UserIndexManager(env);
    this.auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  }

  private getReservationKey(username: string): string {
    return `username:reserved:${username}`;
  }

  private getUserId(context: RequestContext): string {
    return context.userId || "system";
  }

  async reserve(username: string, userId: string, context: RequestContext): Promise<boolean> {
    if (!username || !userId) return false;
    if (UsernameBlocklist.isBlocked(username)) return false;
    
    try {
      const key = this.getReservationKey(username);
      const existing = await this.auditedKV.get(key, this.getUserId(context));
      
      if (existing && existing !== userId) return false;
      
      const owner = await this.indexManager.getUsernameIndex(username, context);
      if (owner && owner !== userId) return false;
      
      await this.auditedKV.put(key, userId, this.getUserId(context), { 
        expirationTtl: RESERVATION_TTL 
      });
      return true;
    } catch (error) {
      console.error(sanitizeError(error, "USERNAME_RESERVE"));
      return false;
    }
  }

  async confirmClaim(username: string, userId: string, context: RequestContext): Promise<boolean> {
    if (!username || !userId) return false;
    if (UsernameBlocklist.isBlocked(username)) return false;
    
    try {
      const key = this.getReservationKey(username);
      const ctxUserId = this.getUserId(context);
      
      const reservedBy = await this.auditedKV.get(key, ctxUserId);
      if (reservedBy !== userId) return false;
      
      const currentOwner = await this.indexManager.getUsernameIndex(username, context);
      if (currentOwner) {
        if (currentOwner !== userId) {
          await this.auditedKV.delete(key, ctxUserId);
          return false;
        }
        await this.auditedKV.delete(key, ctxUserId);
        return true;
      }
      
      await this.indexManager.setUsernameIndex(username, userId, context);
      await this.auditedKV.delete(key, ctxUserId);
      return true;
    } catch (error) {
      console.error(sanitizeError(error, "USERNAME_CONFIRM_CLAIM"));
      return false;
    }
  }

  async release(username: string, userId: string, context: RequestContext): Promise<void> {
    if (!username || !userId) return;
    try {
      const key = this.getReservationKey(username);
      const ctxUserId = this.getUserId(context);
      const reservedBy = await this.auditedKV.get(key, ctxUserId);
      if (reservedBy === userId) {
        await this.auditedKV.delete(key, ctxUserId);
      }
    } catch (error) {
      console.error(sanitizeError(error, "USERNAME_RELEASE"));
    }
  }
}