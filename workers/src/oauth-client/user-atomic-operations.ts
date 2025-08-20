// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { SessionEncryption } from "./session-encryption";
import { UserIndexManager } from "./user-index-manager";
import { ValidatedUserAccount, validateUserAccount } from "./user-validation";
import { sanitizeError } from "../utils/error-sanitizer";
export type UserAccount = ValidatedUserAccount;

export class UserAtomicOperations {
  private encryption: SessionEncryption;
  private indexManager: UserIndexManager;
  
  constructor(private env: Env) {
    this.encryption = new SessionEncryption(env);
    this.indexManager = new UserIndexManager(env);
  }

  async retrieveUserById(id: string, context: RequestContext): Promise<UserAccount | null> {
    if (!id) {
      console.error("USER_RETRIEVE_ID_INVALID");
      return null;
    }
    try {
      const encryptedData = await this.indexManager.getUserData(id, context);
      if (!encryptedData) return null;
      const userData = JSON.parse(await this.encryption.decrypt(encryptedData));
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

  async createUserIfNotExists(
    user: UserAccount,
    context: RequestContext
  ): Promise<{ created: boolean; user: UserAccount }> {
    const validation = validateUserAccount(user);
    if (!validation.success) {
      console.error("USER_CREATE_VALIDATION_FAILED");
      throw new Error("Invalid user data for creation");
    }
    const validUser = validation.data;
    
    try {
      // Check if email already exists
      const existingUserId = await this.indexManager.getEmailIndex(validUser.email, context);
      
      if (existingUserId) {
        const existingUser = await this.retrieveUserById(existingUserId, context);
        if (!existingUser) {
          console.error("USER_CREATE_DATA_INCONSISTENCY");
          throw new Error("Data inconsistency detected");
        }
        return { created: false, user: existingUser };
      }
      
      // Store email index first to claim the email atomically
      await this.indexManager.setEmailIndex(validUser.email, validUser.id, context);
      
      // Double-check that we successfully claimed the email
      const claimedUserId = await this.indexManager.getEmailIndex(validUser.email, context);
      
      if (claimedUserId !== validUser.id) {
        const existingUser = await this.retrieveUserById(claimedUserId || "", context);
        if (!existingUser) {
          console.error("USER_CREATE_RACE_CONDITION_INCONSISTENCY");
          throw new Error("Data inconsistency detected");
        }
        return { created: false, user: existingUser };
      }
      
      // We successfully claimed the email, now store the user data
      try {
        const encryptedData = await this.encryption.encrypt(JSON.stringify(validUser));
        await this.indexManager.setUserData(validUser.id, encryptedData, context);
        if (validUser.username) {
          await this.indexManager.setUsernameIndex(validUser.username, validUser.id, context);
        }
      } catch (error) {
        await this.indexManager.deleteEmailIndex(validUser.email, context);
        if (validUser.username) {
          await this.indexManager.deleteUsernameIndex(validUser.username, context);
        }
        throw error;
      }
      
      return { created: true, user: validUser };
    } catch (error) {
      console.error(sanitizeError(error, "USER_CREATE_ATOMIC"));
      throw new Error("Failed to create user atomically");
    }
  }
}