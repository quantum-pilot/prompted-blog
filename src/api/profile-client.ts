/**
 * Profile API Client - Handles user profile operations with the backend
 * Uses cookie-based authentication for protected endpoints
 */
import { createHonoClient } from './hono-client';
import type {
  GetUserResponse,
  UpdateUserProfileRequest,
  UpdateUserProfileResponse,
  CheckUsernameAvailabilityResponse,
} from '@app/shared/contracts';

export class ProfileClient {
  private readonly honoClient: ReturnType<typeof createHonoClient>;

  constructor(workerUrl?: string) {
    this.honoClient = createHonoClient(workerUrl || this.getDefaultWorkerUrl());
  }

  /** Get the authenticated user's profile */
  async getProfile(): Promise<GetUserResponse> {
    try {
      // Cookies are sent automatically with credentials: 'include'
      const response = await this.honoClient.api.profile.$get({}, {});
      return await response.json() as GetUserResponse;
    } catch (error) {
      return {
        success: false,
        error: 'internal_error',
        error_description: 'Failed to fetch profile. Please try again.',
      };
    }
  }

  /** Update the authenticated user's profile username */
  async updateProfile(username: string): Promise<UpdateUserProfileResponse> {
    try {
      const requestBody: Pick<UpdateUserProfileRequest, 'username'> = { username };
      // Cookies are sent automatically with credentials: 'include'
      const response = await this.honoClient.api.profile.$put(
        { json: requestBody },
        {}
      );
      return await response.json() as UpdateUserProfileResponse;
    } catch (error) {
      return {
        success: false,
        error: 'profile_update_failed',
        error_description: 'Failed to update profile. Please try again.',
      };
    }
  }

  /** Check if a username is available (public endpoint) */
  async checkUsernameAvailability(username: string): Promise<CheckUsernameAvailabilityResponse> {
    try {
      const response = await (this.honoClient.api.username.check as any)[`:username`].$get({
        param: { username },
      });
      return await response.json() as CheckUsernameAvailabilityResponse;
    } catch (error) {
      return {
        success: false,
        error: 'username_invalid',
        error_description: 'Failed to check username availability. Please try again.',
      };
    }
  }

  private getDefaultWorkerUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.hostname === 'localhost' ? 'http://localhost:8787' : window.location.origin;
    }
    return 'http://localhost:8787';
  }
}