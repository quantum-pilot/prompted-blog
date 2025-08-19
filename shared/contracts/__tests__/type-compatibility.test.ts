/**
 * Type compatibility tests
 * Ensures contract schemas align with existing shared types
 */

import { describe, it, expect } from "vitest";
import {
  authorizeRequestSchema,
  authorizeResponseSchema,
  callbackRequestSchema,
  callbackResponseSchema,
  sessionValidationResponseSchema,
  type AuthorizeRequest,
  type AuthorizeResponse,
  type CallbackRequest,
  type CallbackResponse,
  type SessionValidationResponse,
} from "../index";

import type {
  OAuthAuthorizeRequest,
  OAuthAuthorizeResponse,
  OAuthCallbackRequest,
  OAuthCallbackResponse,
  SessionValidationResponse as SharedSessionResponse,
} from "../../types";

describe("Contract Type Compatibility", () => {
  it("authorize request matches shared types", () => {
    const request: OAuthAuthorizeRequest = {
      code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
      state: "random_state_string_123456789012",
      provider: "google",
    };

    // Should parse as contract type
    const contractRequest = {
      query: request,
    };
    expect(() => authorizeRequestSchema.parse(contractRequest)).not.toThrow();
  });

  it("callback request matches shared types", () => {
    const request: OAuthCallbackRequest = {
      code: "auth_code_123",
      state: "random_state_string_123456789012",
      code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      provider: "github",
    };

    // Should parse as contract type
    const contractRequest = {
      body: request,
    };
    expect(() => callbackRequestSchema.parse(contractRequest)).not.toThrow();
  });

  it("authorize success response matches shared types", () => {
    const response: OAuthAuthorizeResponse = {
      success: true,
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    };

    const parsed = authorizeResponseSchema.parse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.authorizationUrl).toBe(response.authorizationUrl);
    }
  });

  it("callback success response matches shared types", () => {
    const response: OAuthCallbackResponse = {
      success: true,
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      user: {
        email: "user@example.com",
        name: "John Doe",
        picture: "https://example.com/photo.jpg",
      },
    };

    const parsed = callbackResponseSchema.parse(response);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.sessionId).toBe(response.sessionId);
      expect(parsed.user.email).toBe(response.user.email);
    }
  });

  it("error responses use discriminated unions correctly", () => {
    const errorResponse: OAuthAuthorizeResponse = {
      success: false,
      error: "invalid_request",
      error_description: "Missing required parameter",
    };

    const parsed = authorizeResponseSchema.parse(errorResponse);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error).toBe("invalid_request");
      expect(parsed.error_description).toBeTruthy();
    }
  });
});