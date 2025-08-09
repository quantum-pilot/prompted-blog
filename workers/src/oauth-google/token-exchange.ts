// Token exchange and user info fetching
import type { Env, StateData, GoogleTokenResponse, GoogleUserInfo } from './types';
import { getTokenUrl, getUserInfoUrl } from './url-builder';

export async function exchangeCodeForToken(
  code: string,
  stateData: StateData,
  env: Env
): Promise<GoogleTokenResponse> {
  const tokenBody = new URLSearchParams({
    code,
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    redirect_uri: env.REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: stateData.codeVerifier,
  });

  const response = await fetch(getTokenUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenBody.toString(),
  });

  const tokenData: GoogleTokenResponse = await response.json();

  if (!response.ok || tokenData.error) {
    console.error('Token exchange failed:', tokenData);
    const errorMessage = tokenData.error_description || 'Failed to exchange authorization code';
    throw new Error(errorMessage);
  }

  return tokenData;
}

export async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(getUserInfoUrl(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.error('Failed to fetch user info:', await response.text());
    throw new Error('Failed to fetch user information');
  }

  return response.json();
}

export function createUserData(userInfo: GoogleUserInfo) {
  return {
    id: userInfo.id,
    email: userInfo.email,
    name: userInfo.name,
    picture: userInfo.picture,
    provider: 'google' as const,
  };
}
