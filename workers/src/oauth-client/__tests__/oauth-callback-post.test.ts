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

// Helper to generate valid PKCE verifier
const generateValidVerifier = (): string => {
  const verifier = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  return btoa(verifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

describe("OAuth Callback POST endpoint", () => {
  let env: any;

  beforeEach(() => {
    env = {
      GOOGLE_CLIENT_ID: "test-client-id",
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "http://localhost:3000/oauth/callback",
      FRONTEND_URL: "http://localhost:3000",
      SESSION_ENCRYPTION_KEY: "test-key-1234567890123456789012",
      SESSION_ENCRYPTION_SALT: "test-salt-for-oauth-callback-post-test",
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
      GOOGLE_CLIENT_SECRET: "test-google-secret",
      OAUTH_SESSIONS: {
        put: async () => {},
  get: async () => null,
        delete: async () => {}
      }
    };
  });

  describe("POST /oauth/callback", () => {
    it("should accept POST request with JSON body", async () => {
      const validState = generateValidState();
      const validVerifier = generateValidVerifier();
      
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: validState,
          code_verifier: validVerifier,
          provider: "google"
        })
      });

      const response = await worker.fetch(request, env, {});

      // Should get 400 because no stored PKCE challenge exists
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");
    });

    it("should reject POST request without code", async () => {
      const validState = generateValidState();
      const validVerifier = generateValidVerifier();
      
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          state: validState,
          code_verifier: validVerifier
        })
      });

      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject POST request without state", async () => {
      const validVerifier = generateValidVerifier();
      
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          code_verifier: validVerifier
        })
      });

      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject POST request without code_verifier", async () => {
      const validState = generateValidState();
      
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: validState
        })
      });

      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should reject POST request with invalid JSON", async () => {
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: "invalid json {"
      });

      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
      expect(data.error_description).toBe("Authentication failed");
    });

    it("should handle POST request with stored PKCE challenge", async () => {
      let deletedKey: string | undefined;
      const validState = generateValidState();
      const validVerifier = generateValidVerifier();
      const validChallenge = btoa(validVerifier).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

      env.OAUTH_SESSIONS.get = async (key: string) => {
        if (key === `pkce:${validState}`) {
          return JSON.stringify({
            challenge: validChallenge,
            state: validState,
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

      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: validState,
          code_verifier: validVerifier,
          provider: "google"
        })
      });

      const response = await worker.fetch(request, env, {});

      // Will fail at PKCE verification but should process the request
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_grant");

      // The PKCE challenge should NOT be deleted on verification failure
      expect(deletedKey).toBeUndefined();
    });

    it("should handle latency requirement for POST", async () => {
      const start = Date.now();
      const validState = generateValidState();
      const validVerifier = generateValidVerifier();
      
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
  body: JSON.stringify({
          code: "test-code",
          state: validState,
          code_verifier: validVerifier
        })
      });

      const response = await worker.fetch(request, env, {});
      const duration = Date.now() - start;

      expect(response.status).toBe(400); // Expected since no PKCE challenge stored
      expect(duration).toBeLessThan(50); // < 50ms requirement
    });

    it("should serve HTML form for GET requests", async () => {
      const request = new Request(
        "http://localhost/oauth/callback?code=test-code&state=test-state",
        {
          headers: {
            "CF-Connecting-IP": "192.168.1.100"
          }
        }
      );
      const response = await worker.fetch(request, env, {});

      // Should serve HTML form for auto-submit
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/html');
      const html = await response.text();
      expect(html).toContain('Completing sign in');
    });
  });
});
