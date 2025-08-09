// State management for OAuth flow
import type { Env, StateData } from './types';
import { generateRandomString, generateCodeChallenge } from './pkce';

const STATE_PREFIX = 'state:';
const STATE_TTL = 600; // 10 minutes

export async function createState(env: Env): Promise<{
  state: string;
  codeChallenge: string;
}> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(128);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const stateData: StateData = {
    codeVerifier,
    timestamp: Date.now(),
  };

  await env.OAUTH_STATE.put(
    `${STATE_PREFIX}${state}`,
    JSON.stringify(stateData),
    { expirationTtl: STATE_TTL }
  );

  return { state, codeChallenge };
}

export async function getState(
  state: string,
  env: Env
): Promise<StateData | null> {
  const key = `${STATE_PREFIX}${state}`;
  const data = await env.OAUTH_STATE.get(key);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as StateData;
  } catch {
    console.error('Failed to parse state data');
    return null;
  }
}

export async function deleteState(state: string, env: Env): Promise<void> {
  const key = `${STATE_PREFIX}${state}`;
  await env.OAUTH_STATE.delete(key);
}
