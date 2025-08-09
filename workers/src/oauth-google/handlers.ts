// OAuth flow handlers
import type { Env } from './types';
import { createState, getState, deleteState } from './state-manager';
import { buildAuthorizationUrl, buildRedirectUrl } from './url-builder';
import { exchangeCodeForToken, fetchUserInfo, createUserData } from './token-exchange';
import { addCorsHeaders, errorResponse } from './cors';

export async function handleOAuthStart(env: Env): Promise<Response> {
  try {
    const { state, codeChallenge } = await createState(env);
    const authUrl = buildAuthorizationUrl(state, codeChallenge, env);

    return new Response(null, {
      status: 302,
      headers: addCorsHeaders({
        Location: authUrl,
      }),
    });
  } catch (error) {
    console.error('OAuth start error:', error);
    return errorResponse('internal_error', 'Failed to initiate OAuth flow');
  }
}

export async function handleOAuthCallback(url: URL, env: Env): Promise<Response> {
  try {
    // Check for OAuth errors
    const error = url.searchParams.get('error');
    if (error) {
      return errorResponse(
        error,
        url.searchParams.get('error_description') || 'OAuth error occurred',
        400
      );
    }

    // Validate parameters
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code) {
      return errorResponse('missing_code', 'Authorization code is required', 400);
    }

    if (!state) {
      return errorResponse('missing_state', 'State parameter is required', 400);
    }

    // Retrieve and validate state
    const stateData = await getState(state, env);
    if (!stateData) {
      return errorResponse('invalid_state', 'Invalid or expired state', 400);
    }

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(code, stateData, env);

    // Get user info
    const userInfo = await fetchUserInfo(tokenData.access_token);

    // Clean up state
    await deleteState(state, env);

    // Create user data and redirect
    const userData = createUserData(userInfo);
    const redirectUrl = buildRedirectUrl(userData, env);

    return new Response(null, {
      status: 302,
      headers: addCorsHeaders({
        Location: redirectUrl,
      }),
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return errorResponse('internal_error', message);
  }
}