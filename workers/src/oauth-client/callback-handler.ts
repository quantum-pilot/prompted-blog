// @agent: cloudflare-backend
/**
 * OAuth callback handler wrapper
 */

import { getCorsHeaders } from "../utils/cors-utils";
import { RequestContext } from "../utils/request-context";
import { handleOAuthCallback, handleOAuthCallbackWithParams } from "./oauth-handler";
import { processOAuthSuccess } from "./user-integration";
import type { Env } from "./types";
import { 
  OAuthCallbackError,
  HttpStatus
} from "../../../shared";

export async function handleCallbackWithParams(
  params: { code: string | null; state: string | null; codeVerifier: string | null; provider?: string | null },
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = context.origin;

  // Handle preflight requests
  if (context.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(context, env),
    });
  }

  // Process OAuth callback with pre-parsed params
  const result = await handleOAuthCallbackWithParams(params, env, context);

  // If successful, create a session
  if (result.status === HttpStatus.OK) {
    const data = (await result.json()) as any;
    if (data.success && data.session) {
      return processOAuthSuccess(data.session, env, context);
    }
  }

  // Pass through error responses with CORS headers
  const responseBody = await result.text();
  const errorData = JSON.parse(responseBody) as OAuthCallbackError;
  
  return new Response(JSON.stringify(errorData), {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(context, env),
    },
  });
}

export async function handleCallback(
  env: Env,
  context: RequestContext
): Promise<Response> {
  const origin = context.origin;

  // Handle preflight requests
  if (context.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(context, env),
    });
  }

  // Process OAuth callback
  const result = await handleOAuthCallback(context.request, env, context);

  // If successful, create a session
  if (result.status === HttpStatus.OK) {
    const data = (await result.json()) as any;
    if (data.success && data.session) {
      return processOAuthSuccess(data.session, env, context);
    }
  }

  // Pass through error responses with CORS headers
  const responseBody = await result.text();
  const errorData = JSON.parse(responseBody) as OAuthCallbackError;
  
  return new Response(JSON.stringify(errorData), {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(context, env),
    },
  });
}
