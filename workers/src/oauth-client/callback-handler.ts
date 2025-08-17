// @agent: cloudflare-backend
/**
 * OAuth callback handler wrapper
 */

import { getCorsHeaders } from "./cors";
import { RequestContext } from "../utils/request-context";
import { SessionManager } from "./session-manager";
import { handleOAuthCallback } from "./oauth-handler";
import type { Env } from "./types";

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
  if (result.status === 200) {
    const data = (await result.json()) as any;
    if (data.success && data.session) {
      const sessionManager = new SessionManager(env);
      const sessionId = await sessionManager.createSession(
        data.session,
        context
      );

      return new Response(
        JSON.stringify({
          success: true,
          sessionId,
          user: {
            email: data.session.email,
            name: data.session.name,
            picture: data.session.picture,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...getCorsHeaders(context, env),
          },
        }
      );
    }
  }

  // Pass through error responses with CORS headers
  const responseBody = await result.text();
  return new Response(responseBody, {
    status: result.status,
    headers: {
      "Content-Type": "application/json",
      ...getCorsHeaders(context, env),
    },
  });
}
