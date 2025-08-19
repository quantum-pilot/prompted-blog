// @agent: cloudflare-backend
/**
 * User integration for OAuth callback flow
 */

import { UserManager } from "./user-manager";
import { SessionManager } from "./session-manager";
import { getCorsHeaders } from "../utils/cors-utils";
import type { Env } from "./types";
import type { RequestContext } from "../utils/request-context";
import { 
  OAuthCallbackSuccess,
  OAuthCallbackError,
  HttpStatus
} from "../../../shared";

export async function processOAuthSuccess(
  sessionData: any,
  env: Env,
  context: RequestContext
): Promise<Response> {
  try {
    // Find or create user account using OAuth data
    const userManager = new UserManager(env);
    const user = await userManager.findOrCreateUser(
      sessionData.email,
      sessionData.provider,
      context,
      sessionData.name,
      sessionData.picture
    );

    // Create session with persistent user ID
    const sessionManager = new SessionManager(env);
    const enrichedSession = {
      ...sessionData,
      userId: user.id, // Use persistent user ID from our database
      oauthSub: sessionData.userId, // Keep OAuth sub claim for reference
    };
    const sessionId = await sessionManager.createSession(
      enrichedSession,
      context
    );

    // Return typed success response
    const successResponse: OAuthCallbackSuccess = {
      success: true,
      sessionId,
      user: {
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    };

    return new Response(
      JSON.stringify(successResponse),
      {
        status: HttpStatus.OK,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(context, env),
        },
      }
    );
  } catch (error) {
    console.error("Failed to create user account:", error);
    const errorResponse: OAuthCallbackError = {
      success: false,
      error: "server_error",
      error_description: "Failed to create user account",
    };
    return new Response(JSON.stringify(errorResponse), {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(context, env),
      },
    });
  }
}