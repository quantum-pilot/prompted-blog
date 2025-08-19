// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { SessionEncryption } from "./session-encryption";
import { AuditedKVStore } from "../utils/audit-kvstore";
import { ValidatedUserAccount, validateUserAccount } from "./user-validation";
import { sanitizeError } from "../utils/error-sanitizer";
const USER_TTL = 30 * 24 * 60 * 60;

// Use validated type instead of loose interface
export type UserAccount = ValidatedUserAccount;

export class UserStorage {
  private encryption: SessionEncryption;
  private auditedKV: AuditedKVStore;
  constructor(private env: Env) {
    this.encryption = new SessionEncryption(env);
    this.auditedKV = new AuditedKVStore(env.OAUTH_SESSIONS);
  }

  async storeUser(user: UserAccount, context: RequestContext): Promise<void> {
    // Validate user data before storage
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_STORE_VALIDATION_FAILED");
      throw new Error("Invalid user data for storage");
    }
    const validUser = validation.data;
    
    try {
      const encryptedData = await this.encryption.encrypt(JSON.stringify(validUser));
      await this.auditedKV.put(`user:id:${validUser.id}`, encryptedData,
        context.userId || "system", { expirationTtl: USER_TTL });
      await this.auditedKV.put(`user:email:${validUser.email}`, validUser.id,
        context.userId || "system", { expirationTtl: USER_TTL });
    } catch (error) {
      console.error(sanitizeError(error, "USER_STORE"));
      throw new Error("Failed to store user data");
    }
  }

  async retrieveUserByEmail(email: string, context: RequestContext): Promise<UserAccount | null> {
    if (!email) {
      console.error("USER_RETRIEVE_EMAIL_INVALID");
      return null;
    }
    try {
      const userId = await this.auditedKV.get(
        `user:email:${email}`,
        context.userId || "system"
      );
      if (!userId) return null;
      return await this.retrieveUserById(userId, context);
    } catch (error) {
      console.error(sanitizeError(error, "USER_RETRIEVE_BY_EMAIL"));
      return null;
    }
  }

  async retrieveUserById(id: string, context: RequestContext): Promise<UserAccount | null> {
    if (!id) {
      console.error("USER_RETRIEVE_ID_INVALID");
      return null;
    }
    try {
      const encryptedData = await this.auditedKV.get(
        `user:id:${id}`,
        context.userId || "system"
      );
      if (!encryptedData) return null;
      const decryptedData = await this.encryption.decrypt(encryptedData);
      const userData = JSON.parse(decryptedData);
      
      // Validate retrieved data
      const validation = validateUserAccount(userData);
      if (!validation.success) {
        console.error("USER_RETRIEVE_VALIDATION_FAILED");
        return null;
      }
      return validation.data;
    } catch (error) {
      console.error(sanitizeError(error, "USER_RETRIEVE_BY_ID"));
      return null;
    }
  }

  async updateUser(user: UserAccount, context: RequestContext): Promise<void> {
    // Validate user data before update
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_UPDATE_VALIDATION_FAILED");
      throw new Error("Invalid user data for update");
    }
    const validUser = validation.data;
    
    try {
      const existingUser = await this.retrieveUserById(validUser.id, context);
      const updatedUser = { ...validUser, updatedAt: new Date().toISOString() };
      if (existingUser && existingUser.email !== validUser.email) {
        await this.auditedKV.delete(
          `user:email:${existingUser.email}`,
          context.userId || "system"
        );
      }
      await this.storeUser(updatedUser, context);
    } catch (error) {
      console.error(sanitizeError(error, "USER_UPDATE"));
      throw new Error("Failed to update user data");
    }
  }

  async createUserIfNotExists(
    user: UserAccount,
    context: RequestContext
  ): Promise<{ created: boolean; user: UserAccount }> {
    // Validate user data before creation
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_CREATE_VALIDATION_FAILED");
      throw new Error("Invalid user data for creation");
    }
    const validUser = validation.data;
    
    try {
      // Try to atomically create the email key first
      // This acts as our lock to prevent duplicate users with same email
      const emailKey = `user:email:${validUser.email}`;
      
      // Check if email already exists
      const existingUserId = await this.auditedKV.get(emailKey, context.userId || "system");
      
      if (existingUserId) {
        // Email already exists, retrieve and return the existing user
        const existingUser = await this.retrieveUserById(existingUserId, context);
        if (!existingUser) {
          // Edge case: email index exists but user data doesn't
          console.error("USER_CREATE_DATA_INCONSISTENCY");
          throw new Error("Data inconsistency detected");
        }
        return { created: false, user: existingUser };
      }
      
      // Email doesn't exist, try to create it atomically
      // Store email index first to claim the email
      await this.auditedKV.put(
        emailKey,
        validUser.id,
        context.userId || "system",
        { expirationTtl: USER_TTL }
      );
      
      // Double-check that we successfully claimed the email
      // This handles the race condition where another request might have created it
      const claimedUserId = await this.auditedKV.get(emailKey, context.userId || "system");
      
      if (claimedUserId !== validUser.id) {
        // Another request won the race, return the existing user
        const existingUser = await this.retrieveUserById(claimedUserId, context);
        if (!existingUser) {
          console.error("USER_CREATE_RACE_CONDITION_INCONSISTENCY");
          throw new Error("Data inconsistency detected");
        }
        return { created: false, user: existingUser };
      }
      
      // We successfully claimed the email, now store the user data
      try {
        const encryptedData = await this.encryption.encrypt(JSON.stringify(validUser));
        await this.auditedKV.put(
          `user:id:${validUser.id}`,
          encryptedData,
          context.userId || "system",
          { expirationTtl: USER_TTL }
        );
      } catch (error) {
        // If user data storage fails, clean up the email index
        await this.auditedKV.delete(emailKey, context.userId || "system");
        throw error;
      }
      
      return { created: true, user: validUser };
    } catch (error) {
      console.error(sanitizeError(error, "USER_CREATE_ATOMIC"));
      throw new Error("Failed to create user atomically");
    }
  }
}