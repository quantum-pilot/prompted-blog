// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleOAuthCallback } from "../oauth-handler";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("OAuth Handler Error Sanitization", () => {
  let mockEnv: Env;
  let mockContext: RequestContext;

  beforeEach(() => {
    mockEnv = {
      GOOGLE_CLIENT_ID: "test-client-id",
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "https://example.com/callback",
      FRONTEND_URL: "https://example.com",
      OAUTH_SESSIONS: {
        get: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        list: vi.fn(),
        getWithMetadata: vi.fn(),
      },
    };

    mockContext = {
      requestId: "test-request-id",
      userId: null,
      startTime: Date.now(),
      log: vi.fn(),
    };
  });

  it("should return generic error message when code is missing", async () => {
    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: "test-state",
        code_verifier: "test-verifier",
        // code is missing
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Authentication failed");
    // Ensure no sensitive details are exposed
    expect(JSON.stringify(body)).not.toContain("Missing authorization code");
    expect(JSON.stringify(body)).not.toContain("missing_code");
  });

  it("should return generic error message when state is missing", async () => {
    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "test-code",
        code_verifier: "test-verifier",
        // state is missing
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Authentication failed");
    // Ensure no CSRF attack details are exposed
    expect(JSON.stringify(body)).not.toContain("CSRF");
    expect(JSON.stringify(body)).not.toContain("missing_state");
  });

  it("should return generic error message when PKCE verifier is missing", async () => {
    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "test-code",
        state: "test-state",
        // code_verifier is missing
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Authentication failed");
    // Ensure no PKCE details are exposed
    expect(JSON.stringify(body)).not.toContain("PKCE");
    expect(JSON.stringify(body)).not.toContain("verifier");
    expect(JSON.stringify(body)).not.toContain("missing_code_verifier");
  });

  it("should return generic error message for invalid state format", async () => {
    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "test-code",
        state: "invalid!@#$%^&*()state",
        code_verifier: "test-verifier",
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_request");
    expect(body.error_description).toBe("Authentication failed");
    // Ensure no state format details are exposed
    expect(JSON.stringify(body)).not.toContain("state_format");
    expect(JSON.stringify(body)).not.toContain("invalid_state_format");
    expect(JSON.stringify(body)).not.toContain("stateLength");
  });

  it("should return generic error message when session is not found", async () => {
    (mockEnv.OAUTH_SESSIONS.get as any).mockResolvedValue(null);

    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "test-code",
        state: "test-state",
        code_verifier: "test-verifier",
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("invalid_grant");
    expect(body.error_description).toBe("Authentication failed");
    // Ensure no session details are exposed
    expect(JSON.stringify(body)).not.toContain("session");
    expect(JSON.stringify(body)).not.toContain("PKCE");
    expect(JSON.stringify(body)).not.toContain("challenge");
  });

  it("should log detailed errors but return sanitized messages", async () => {
    const request = new Request("https://example.com/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: "test-state",
        code_verifier: "test-verifier",
        // code is missing
      }),
    });
    const response = await handleOAuthCallback(request, mockEnv, mockContext);

    // Check that detailed error was logged
    expect(mockContext.log).toHaveBeenCalledWith(
      expect.any(String),
      "failure",
      expect.objectContaining({
        reason: "Missing authorization code",
      })
    );

    // But response is sanitized
    const body = await response.json();
    expect(body.error_description).toBe("Authentication failed");
    expect(JSON.stringify(body)).not.toContain("Missing authorization code");
  });
});
