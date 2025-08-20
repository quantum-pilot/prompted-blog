// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { SessionEncryption } from "./session-encryption";
import { UserIndexManager } from "./user-index-manager";
import { UserAtomicOperations } from "./user-atomic-operations";
import { ValidatedUserAccount, validateUserAccount } from "./user-validation";
import { sanitizeError } from "../utils/error-sanitizer";
export type UserAccount = ValidatedUserAccount;

export class UserStorage {
  private encryption: SessionEncryption;
  private indexManager: UserIndexManager;
  private atomicOps: UserAtomicOperations;
  
  constructor(private env: Env) {
    this.encryption = new SessionEncryption(env);
    this.indexManager = new UserIndexManager(env);
    this.atomicOps = new UserAtomicOperations(env);
  }

  async storeUser(user: UserAccount, context: RequestContext): Promise<void> {
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_STORE_VALIDATION_FAILED");
      throw new Error("Invalid user data for storage");
    }
    const validUser = validation.data;
    try {
      const encryptedData = await this.encryption.encrypt(JSON.stringify(validUser));
      await this.indexManager.setUserData(validUser.id, encryptedData, context);
      await this.indexManager.setEmailIndex(validUser.email, validUser.id, context);
      if (validUser.username) {
        await this.indexManager.setUsernameIndex(validUser.username, validUser.id, context);
      }
    } catch (error) {
      console.error(sanitizeError(error, "USER_STORE"));
      throw new Error("Failed to store user data");
    }
  }

  async retrieveUserByEmail(email: string, context: RequestContext): Promise<UserAccount | null> {
    if (!email) return null;
    try {
      const userId = await this.indexManager.getEmailIndex(email, context);
      return userId ? await this.retrieveUserById(userId, context) : null;
    } catch (error) {
      console.error(sanitizeError(error, "USER_RETRIEVE_BY_EMAIL"));
      return null;
    }
  }

  async retrieveUserByUsername(username: string, context: RequestContext): Promise<UserAccount | null> {
    if (!username) return null;
    try {
      const userId = await this.indexManager.getUsernameIndex(username, context);
      return userId ? await this.retrieveUserById(userId, context) : null;
    } catch (error) {
      console.error(sanitizeError(error, "USER_RETRIEVE_BY_USERNAME"));
      return null;
    }
  }

  async checkUsernameAvailability(username: string, context: RequestContext): Promise<boolean> {
    return await this.indexManager.checkUsernameAvailable(username, context);
  }

  async retrieveUserById(id: string, context: RequestContext): Promise<UserAccount | null> {
    return await this.atomicOps.retrieveUserById(id, context);
  }

  async updateUser(user: UserAccount, context: RequestContext): Promise<void> {
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_UPDATE_VALIDATION_FAILED");
      throw new Error("Invalid user data for update");
    }
    const validUser = validation.data;
    try {
      const existingUser = await this.retrieveUserById(validUser.id, context);
      const updatedUser = { ...validUser, updatedAt: new Date().toISOString() };
      if (existingUser) {
        if (existingUser.email !== validUser.email) {
          await this.indexManager.deleteEmailIndex(existingUser.email, context);
        }
        if (existingUser.username && existingUser.username !== validUser.username) {
          await this.indexManager.deleteUsernameIndex(existingUser.username, context);
        }
        if (existingUser.username && !validUser.username) {
          await this.indexManager.deleteUsernameIndex(existingUser.username, context);
        }
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
    return await this.atomicOps.createUserIfNotExists(user, context);
  }
}