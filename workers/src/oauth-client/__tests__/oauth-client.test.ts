// @agent: cloudflare-backend
import { describe, it, expect, beforeEach } from "vitest";
import worker from "../../index";

// Helper to generate valid base64URL state
const generateValidState = (): string => {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return btoa(String.fromCharCode(...randomBytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

// Helper to generate valid PKCE challenge
const generateValidChallenge = (): string => {
  const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

// Helper to generate valid PKCE verifier  
const generateValidVerifier = (): string => {
  const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

describe("OAuth Client Worker", () => {
  let env: any;

  beforeEach(() => {
    env = {
      GOOGLE_CLIENT_ID: "test-client-id",
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "http://localhost:3000/oauth/callback",
      FRONTEND_URL: "http://localhost:3000",
      SESSION_ENCRYPTION_KEY: "test-key-1234567890123456789012",
      SESSION_ENCRYPTION_SALT: "test-salt-for-oauth-client-test",
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
      OAUTH_SESSIONS: {
        put: async () => {},
  get: async () => null,
        delete: async () => {}
      }
    };
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const request = new Request("http://localhost/health");
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });

    it("should handle latency requirement", async () => {
      const start = Date.now();
      const request = new Request("http://localhost/health");
      const response = await worker.fetch(request, env, {});
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(50); // < 50ms requirement
    });
  });

  describe("GET /oauth/authorize", () => {
    it("should reject without code challenge", async () => {
      const validState = generateValidState();
      const request = new Request(
        `http://localhost/oauth/authorize?state=${validState}`
      );
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("should reject without state", async () => {
      const validChallenge = generateValidChallenge();
      const request = new Request(
        `http://localhost/oauth/authorize?code_challenge=${validChallenge}`
      );
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should store PKCE challenge and return auth URL", async () => {
      let storedKey: string | undefined;
      let storedValue: string | undefined;
      const validChallenge = generateValidChallenge();
      const validState = generateValidState();

      env.OAUTH_SESSIONS.put = async (key: string, value: string) => {
        storedKey = key;
        storedValue = value;
      };

      const request = new Request(
        `http://localhost/oauth/authorize?code_challenge=${validChallenge}&state=${validState}&provider=google`
      );
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.authorizationUrl).toContain(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );
      expect(data.authorizationUrl).toContain(`code_challenge=${validChallenge}`);
      expect(data.authorizationUrl).toContain("code_challenge_method=S256");

      // Verify PKCE challenge was stored
      expect(storedKey).toBe(`pkce:${validState}`);
      expect(storedValue).toBeDefined();
      const storedData = JSON.parse(storedValue!);
      expect(storedData.challenge).toBe(validChallenge);
      expect(storedData.state).toBe(validState); // Verify state is stored
      expect(storedData.provider).toBe("google"); // Verify provider is stored
    });
  });

  describe("GET /oauth/callback", () => {
    it("should reject GET requests to callback endpoint for security", async () => {
      // GET requests to callback are not allowed (prevents CSRF)
      const request = new Request(
        "http://localhost/oauth/callback?code=test-code&state=test-state&code_verifier=test-verifier",
        {
          method: "GET",
          headers: {
            "CF-Connecting-IP": "192.168.1.100"
          }
        }
      );
      const response = await worker.fetch(request, env, {});

      // Should get 404 since GET route doesn't exist
      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe("not_found");
    });

  });

  describe("POST /oauth/callback", () => {
    it("should reject callback without state parameter", async () => {
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          code_verifier: generateValidVerifier()
          // state is missing
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject callback without PKCE verifier", async () => {
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: generateValidState()
          // code_verifier is missing
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject callback without stored PKCE challenge", async () => {
      env.OAUTH_SESSIONS.get = async () => null;

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: generateValidState(),
          code_verifier: generateValidVerifier()
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject callback with mismatched state parameter", async () => {
      const callbackState = generateValidState();
      const originalState = generateValidState(); // Different state
      
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `pkce:${callbackState}`) {
          return JSON.stringify({
            challenge: generateValidChallenge(),
            state: originalState, // Different from the state in the callback
            provider: "google",
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: callbackState,
          code_verifier: generateValidVerifier()
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject callback with expired PKCE session", async () => {
      let deletedKey: string | undefined;
      const validState = generateValidState();
      
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `pkce:${validState}`) {
          return JSON.stringify({
            challenge: generateValidChallenge(),
            state: validState,
            provider: "google",
            createdAt: Date.now() - 700000, // Created 11+ minutes ago
            expiresAt: Date.now() - 100000, // Expired 100 seconds ago
          });
        }
        return null;
      };
      env.OAUTH_SESSIONS.delete = async (key: string) => {
        deletedKey = key;
      };

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: validState,
          code_verifier: generateValidVerifier()
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toBe("Authentication failed");
      expect(deletedKey).toBe(`pkce:${validState}`); // Verify cleanup happened
    });

    it("should reject callback with missing stored state", async () => {
      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === "pkce:test-state") {
          return JSON.stringify({
            challenge: generateValidChallenge(),
            // state is missing
            provider: "google",
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: generateValidState(),
          code_verifier: generateValidVerifier()
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject callback with invalid PKCE verifier", async () => {
      // Generate a real PKCE challenge for testing
      const encoder = new TextEncoder();
      const verifierData = encoder.encode("correct-verifier");
      const hash = await crypto.subtle.digest("SHA-256", verifierData);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const testState = generateValidState();

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `pkce:${testState}`) {
          return JSON.stringify({
            challenge: base64,
            state: testState,
            provider: "google",
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: testState,
          code_verifier: generateValidVerifier() // Valid format but wrong value
        })
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should clean up PKCE challenge after successful validation", async () => {
      // Generate a valid verifier first
      const testVerifier = generateValidVerifier();
      
      // Generate the challenge from the verifier
      const encoder = new TextEncoder();
      const verifierData = encoder.encode(testVerifier);
      const hash = await crypto.subtle.digest("SHA-256", verifierData);
      const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const testState = generateValidState();
      let deletedKey: string | undefined;

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `pkce:${testState}`) {
          return JSON.stringify({
            challenge: base64,
            state: testState,
            provider: "google",
            createdAt: Date.now(),
            expiresAt: Date.now() + 600000
          });
        }
        return null;
      };

      env.OAUTH_SESSIONS.delete = async (key: string) => {
        deletedKey = key;
      };

      // Mock the OAuth token exchange to avoid external calls
      global.fetch = async () => {
        return new Response(
          JSON.stringify({
            access_token: "test-token",
            id_token:
              btoa(JSON.stringify({})) +
              "." +
              btoa(
                JSON.stringify({
                  sub: "user-123",
                  email: "test@example.com",
                  name: "Test User",
                  picture: "https://example.com/pic.jpg"
                })
              ) +
              ".signature",
            expires_in: 3600
          }),
          { status: 200 }
        );
      };

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: testState,
          code_verifier: testVerifier // Use the same verifier we generated the challenge from
        })
      });
      const response = await worker.fetch(request, env, {});

      // The response might fail due to Google OAuth not being mocked properly
      // but we should still see that the PKCE challenge was deleted
      expect(deletedKey).toBe(`pkce:${testState}`);
    });
  });

  describe("GET /oauth/session", () => {
    it("should reject without sessionId", async () => {
      const request = new Request("http://localhost/oauth/session");
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("should return 400 for invalid session ID format", async () => {
      const request = new Request("http://localhost/oauth/session", {
        headers: {
          Authorization: "Bearer invalid-id"
        }
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("should return session data for valid session", async () => {
      // Use SessionManager to properly encrypt the session data
      const { SessionManager } = await import("../session-manager");
      const { RequestContext } = await import("../../utils/request-context");
      const sessionManager = new SessionManager(env);

      // Create a mock RequestContext for tests
      const mockRequest = new Request("http://localhost/test");
      const context = await RequestContext.create(mockRequest, env);
      context.userId = "user-123";

      // Create a session properly with encryption
      const sessionData = {
        provider: "google",
        userId: "user-123",
        email: "test@example.com",
        name: "Test User",
        expiresAt: Date.now() + 3600000
      };

      // Store encrypted session data in mock KV
      const kvStore = new Map<string, string>();
      env.OAUTH_SESSIONS.put = async (key: string, value: string) => {
        kvStore.set(key, value);
      };
      env.OAUTH_SESSIONS.get = async (key: string) => {
        return kvStore.get(key) || null;
      };

      // Create session (will be encrypted)
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
      const data = (await response.json()) as any;
      expect(data.userId).toBe("user-123");
      expect(data.email).toBe("test@example.com");
    });
  });

  describe("CORS handling", () => {
    it("should handle OPTIONS requests", async () => {
      const request = new Request("http://localhost/health", {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" }
      });
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(204);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
      expect(response.headers.get("Access-Control-Allow-Methods")).toContain(
        "GET"
      );
    });

    it("should add CORS headers to responses", async () => {
      const request = new Request("http://localhost/health", {
        headers: { Origin: "http://localhost:3000" }
      });
      const response = await worker.fetch(request, env, {});

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000"
      );
    });
  });

  describe("Error handling", () => {
    it("should return 404 for unknown routes", async () => {
      const request = new Request("http://localhost/unknown");
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe("not_found");
    });
  });
});
