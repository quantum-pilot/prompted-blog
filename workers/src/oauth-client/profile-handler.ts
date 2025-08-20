// @agent: cloudflare-backend
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { UsernameChecker } from "./username-checker";
import { UserIndexManager } from "./user-index-manager";
import { sanitizeError } from "../utils/error-sanitizer";
import { checkUsernameValidity } from "./username-blocklist";
import { ConstantTimeHelper } from "./constant-time-helper";
import {
  type UserAccount, type UpdateUserProfileRequest, type UpdateUserProfileResponse,
  type CheckUsernameAvailabilityRequest, type CheckUsernameAvailabilityResponse,
  type GetUserResponse, UsernameSchema,
} from "../../../shared/contracts/user.contract";

export class ProfileHandler {
  public usernameChecker: UsernameChecker;
  public indexManager: UserIndexManager;

  constructor(private env: Env) {
    this.usernameChecker = new UsernameChecker(env);
    this.indexManager = new UserIndexManager(env);
  }

  async getProfile(userId: string, context: RequestContext): Promise<GetUserResponse> {
    try {
      const userData = await this.indexManager.getUserData(userId, context);
      if (!userData) return { success: false, error: "user_not_found", error_description: "User profile not found" };
      return { success: true, user: JSON.parse(userData) };
    } catch (error) {
      console.error(sanitizeError(error, "GET_PROFILE"));
      return { success: false, error: "internal_error", error_description: "Failed to retrieve user profile" };
    }
  }

  async updateProfile(req: UpdateUserProfileRequest, ctx: RequestContext): Promise<UpdateUserProfileResponse> {
    const validation = UsernameSchema.safeParse(req.username);
    if (!validation.success)
      return { success: false, error: "username_invalid", 
        error_description: validation.error?.issues?.[0]?.message || "Invalid username format" };
    
    try {
      const userData = await this.indexManager.getUserData(req.id, ctx);
      if (!userData) return { success: false, error: "profile_update_failed", error_description: "User not found" };

      const user: UserAccount = JSON.parse(userData);
      if (user.username)
        return { success: false, error: "profile_update_failed", 
          error_description: "User already has a username. Username can only be set once." };

      if (!(await this.usernameChecker.isAvailable(req.username, ctx)))
        return { success: false, error: "username_taken", error_description: "Username is already taken" };

      if (!(await this.usernameChecker.reserve(req.username, req.id, ctx)))
        return { success: false, error: "username_taken", error_description: "Username was claimed by another user" };

      if (!(await this.usernameChecker.confirmClaim(req.username, req.id, ctx))) {
        await this.usernameChecker.release(req.username, req.id, ctx);
        return { success: false, error: "username_taken", error_description: "Failed to claim username" };
      }

      const updatedUser: UserAccount = { ...user, username: req.username, updatedAt: Date.now() };
      await this.indexManager.setUserData(req.id, JSON.stringify(updatedUser), ctx);
      return { success: true, user: updatedUser };
    } catch (error) {
      console.error(sanitizeError(error, "UPDATE_PROFILE"));
      return { success: false, error: "profile_update_failed", error_description: "Failed to update profile" };
    }
  }

  async checkUsernameAvailability(
    req: CheckUsernameAvailabilityRequest, ctx: RequestContext
  ): Promise<CheckUsernameAvailabilityResponse> {
    const timer = new ConstantTimeHelper();
    
    const validation = UsernameSchema.safeParse(req.username);
    if (!validation.success) {
      await timer.ensureConstantTime();
      return { success: false, error: "username_invalid",
        error_description: validation.error?.issues?.[0]?.message || "Invalid username format" };
    }
    
    // Check blocklist
    const blockReason = checkUsernameValidity(req.username);
    if (blockReason) {
      await timer.ensureConstantTime();
      return { success: true, available: false };
    }
    
    try {
      const available = await this.usernameChecker.isAvailable(req.username, ctx);
      await timer.ensureConstantTime();
      return { success: true, available };
    } catch (error) {
      console.error(sanitizeError(error, "CHECK_USERNAME"));
      await timer.ensureConstantTime();
      return { success: true, available: false };
    }
  }
}