// @agent: cloudflare-backend
import type { GoogleUserInfo, StandardizedUser } from './types';
import { RequestContext } from '../utils/request-context';
import { AuditEventType } from '../utils/audit-logger';

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Fetches Google user profile using access token
 * @param accessToken OAuth access token
 * @param context Request context for logging
 * @returns Google user profile information
 */
export async function fetchUserProfile(
  accessToken: string,
  context: RequestContext
): Promise<GoogleUserInfo> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // Security: Log error status without potentially sensitive response body
      console.error('Failed to fetch user profile:', {
        status: response.status,
        statusText: response.statusText
      });

      // Log through context
      context.log(AuditEventType.API_CALL_FAILED, 'failure', {
        api: 'google_oauth',
        operation: 'fetch_user_profile',
        status: response.status,
        statusText: response.statusText
      });

      throw new Error('Failed to fetch user profile');
    }

    const userInfo = await response.json() as GoogleUserInfo;

    // Log through context
    context.log(AuditEventType.API_CALL_SUCCESS, 'success', {
      api: 'google_oauth',
      operation: 'fetch_user_profile',
      hasEmail: !!userInfo.email,
      hasName: !!userInfo.name
    });

    return userInfo;
  } catch (error) {
    // Log network or other error during user profile fetch
    if (!(error instanceof Error && error.message.includes('Failed to fetch'))) {
      context.log(AuditEventType.API_CALL_FAILED, 'failure', {
        api: 'google_oauth',
        operation: 'fetch_user_profile',
        error: error instanceof Error ? error.message : 'Unknown error',
        type: 'network_error'
      });
    }
    throw error;
  }
}

/**
 * Transforms Google user info to standardized user format
 * @param userInfo Google user information
 * @returns Standardized user object
 */
export function standardizeUser(userInfo: GoogleUserInfo): StandardizedUser {
  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    provider: 'google',
  };
}
