/**
 * Profile API Client - Handles user profile operations with the backend
 * Requires authentication via session ID for protected endpoints
 */
import { createHonoClient, getAuthHeaders } from './hono-client';
import { getSessionId } from './oauth-session';
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
      const sessionId = getSessionId();
      if (!sessionId) {
        return { success: false, error: 'unauthorized', error_description: 'No active session' };
      }
      const response = await this.honoClient.api.profile.$get({}, { headers: getAuthHeaders(sessionId) });
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
      const sessionId = getSessionId();
      if (!sessionId) {
        return { success: false, error: 'profile_update_failed', error_description: 'No active session' };
      }
      const requestBody: Pick<UpdateUserProfileRequest, 'username'> = { username };
      const response = await this.honoClient.api.profile.$put(
        { json: requestBody },
        { headers: getAuthHeaders(sessionId) }
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