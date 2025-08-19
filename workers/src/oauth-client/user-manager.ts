// @agent: cloudflare-backend
import { UserStorage, UserAccount } from "./user-storage";
import type { RequestContext } from "../utils/request-context";
import type { Env } from "./types";
import { AuditEventType } from "../utils/audit-logger";
import { sanitizeUserInput } from "./user-validation";
import { sanitizeError } from "../utils/error-sanitizer";
import { RateLimiter } from "../utils/rate-limiter";

export class UserManager {
  private storage: UserStorage;
  private rateLimiter: RateLimiter;
  
  constructor(env: Env) { 
    this.storage = new UserStorage(env);
    // Initialize rate limiter: 5 user creations per minute per IP
    this.rateLimiter = new RateLimiter({
      kv: env.OAUTH_SESSIONS,
      limit: 5,
      windowMs: 60000, // 1 minute
      keyPrefix: "user-creation"
    });
  }

  async createUser(
    email: string,
    provider: string,
    context: RequestContext
  ): Promise<UserAccount> {
    try {
      // Get client IP address for rate limiting
      const ipAddress = this.getClientIp(context.request);
      const rateLimitKey = `user-creation:${ipAddress}`;
      
      // Check rate limit
      const isAllowed = await this.rateLimiter.isAllowed(rateLimitKey);
      if (!isAllowed) {
        // Log rate limit violation
        context.log(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, "failure", {
          action: "user_creation",
          ipAddress,
        });
        throw new Error("Too many user creation attempts. Please try again later.");
      }
      
      // Use sanitizeUserInput to create validated user
      const user = sanitizeUserInput({
        email,
        provider
      });
      await this.storage.storeUser(user, context);
      context.log(AuditEventType.USER_CREATED, "success", {
        userId: user.id,
        email: user.email,
        provider,
      });
      return user;
    } catch (error) {
      // If it's a rate limit error, re-throw it
      if ((error as Error).message?.includes("Too many user creation attempts")) {
        throw error;
      }
      console.error(sanitizeError(error, "USER_CREATE"));
      context.log(AuditEventType.USER_CREATED, "failure", {
        provider,
        errorType: "USER_CREATE_FAILED",
      });
      throw new Error("Failed to create user");
    }
  }

  async findOrCreateUser(
    email: string,
    provider: string,
    context: RequestContext,
    name?: string,
    picture?: string
  ): Promise<UserAccount> {
    try {
      // Get client IP address for rate limiting
      const ipAddress = this.getClientIp(context.request);
      const rateLimitKey = `user-creation:${ipAddress}`;
      
      // Check rate limit before attempting to create a user
      const isAllowed = await this.rateLimiter.isAllowed(rateLimitKey);
      if (!isAllowed) {
        // Log rate limit violation
        context.log(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, "failure", {
          action: "user_creation",
          ipAddress,
        });
        throw new Error("Too many user creation attempts. Please try again later.");
      }
      
      // Use sanitizeUserInput to create validated user
      const newUser = sanitizeUserInput({
        email,
        provider,
        name,
        picture
      });

      // Try to create user atomically
      const result = await this.storage.createUserIfNotExists(newUser, context);
      
      if (result.created) {
        // New user was created successfully
        context.log(AuditEventType.USER_CREATED, "success", {
          userId: result.user.id,
          email,
          provider,
        });
        return result.user;
      } else {
        // User already exists
        const existingUser = result.user;
        
        // Check if we need to update name or picture
        if (name || picture) {
          const hasChanges = 
            (name && name !== existingUser.name) ||
            (picture && picture !== existingUser.picture);
          
          if (hasChanges) {
            // Validate the updated user data
            const updatedUser = sanitizeUserInput({
              id: existingUser.id,
              email: existingUser.email,
              name: name || existingUser.name,
              picture: picture || existingUser.picture,
              provider: existingUser.metadata?.provider
            });
            await this.storage.updateUser(updatedUser, context);
            context.log(AuditEventType.USER_UPDATED, "success", {
              userId: existingUser.id,
              email,
            });
            return updatedUser;
          }
        }
        
        return existingUser;
      }
    } catch (error) {
      // If it's a rate limit error, re-throw it
      if ((error as Error).message?.includes("Too many user creation attempts")) {
        throw error;
      }
      console.error(sanitizeError(error, "USER_FIND_OR_CREATE"));
      context.log(AuditEventType.USER_CREATED, "failure", {
        errorType: "USER_FIND_OR_CREATE_FAILED",
      });
      throw new Error("Failed to find or create user");
    }
  }

  async getUserById(id: string, context: RequestContext): Promise<UserAccount | null> {
    return await this.storage.retrieveUserById(id, context);
  }

  async getUserByEmail(email: string, context: RequestContext): Promise<UserAccount | null> {
    return await this.storage.retrieveUserByEmail(email, context);
  }
  
  /**
   * Get the client IP address from the request
   * Uses CF-Connecting-IP header when available (production)
   * Falls back to 127.0.0.1 in test environment
   */
  private getClientIp(request: Request): string {
    const cfIp = request.headers.get("CF-Connecting-IP");
    if (cfIp) {
      return cfIp;
    }
    // In test environment, use a fallback IP
    if (process.env.NODE_ENV === 'test') {
      return '127.0.0.1';
    }
    // If CF-Connecting-IP is missing in production, this is a security issue
    throw new Error("Security Error: CF-Connecting-IP header missing");
  }
}