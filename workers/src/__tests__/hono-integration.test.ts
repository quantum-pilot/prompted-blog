// @agent: cloudflare-backend
/**
 * Integration tests for Hono implementation with contracts
 */

import { describe, it, expect, beforeEach } from "vitest";
import worker from "../index";
import type { Env } from "../oauth-client/types";

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

describe("Hono Integration Tests", () => {
  let env: Env;

  beforeEach(() => {
    const kvStore = new Map<string, string>();
    
    env = {
      GOOGLE_CLIENT_ID: "test-client-id",
      CLIENT_ID: "test-client-id",
      REDIRECT_URI: "http://localhost:3000/oauth/callback",
      FRONTEND_URL: "http://localhost:3000",
      SESSION_ENCRYPTION_KEY: "test-key-1234567890123456789012",
      SESSION_ENCRYPTION_SALT: "test-salt-for-integration-test",
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
      OAUTH_SESSIONS: {
        put: async (key: string, value: string) => {
          kvStore.set(key, value);
        },
        get: async (key: string) => kvStore.get(key) || null,
        delete: async (key: string) => {
          kvStore.delete(key);
        }
      } as any
    };
  });

  describe("Contract Validation", () => {
    it("should reject invalid authorize request with missing state", async () => {
      const validChallenge = generateValidChallenge();
      const request = new Request(
        `http://localhost/oauth/authorize?code_challenge=${validChallenge}`
      );
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("should reject invalid callback request with missing code", async () => {
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

    it("should accept valid authorize request", async () => {
      const validChallenge = generateValidChallenge();
      const validState = generateValidState();
      
      const request = new Request(
        `http://localhost/oauth/authorize?code_challenge=${validChallenge}&state=${validState}&provider=google`
      );
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.success).toBe(true);
      expect(data.authorizationUrl).toContain("https://accounts.google.com");
    });

    it("should handle valid callback request with no stored PKCE", async () => {
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
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      // When PKCE challenge is not found, it should return invalid_grant
      expect(data.error).toBe("invalid_grant");
    });
  });

  describe("Response Type Validation", () => {
    it("should return properly typed authorize response", async () => {
      const validChallenge = generateValidChallenge();
      const validState = generateValidState();
      
      const request = new Request(
        `http://localhost/oauth/authorize?code_challenge=${validChallenge}&state=${validState}&provider=google`
      );
      const response = await worker.fetch(request, env, {});

      const data = (await response.json()) as any;
      
      if (data.success) {
        expect(data).toHaveProperty("authorizationUrl");
        expect(typeof data.authorizationUrl).toBe("string");
      } else {
        expect(data).toHaveProperty("error");
        expect(data).toHaveProperty("error_description");
      }
    });

    it("should return properly typed health check response", async () => {
      const request = new Request("http://localhost/health");
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
      expect(typeof data.timestamp).toBe("number");
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed JSON in callback", async () => {
      const request = new Request("http://localhost/oauth/callback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CF-Connecting-IP": "192.168.1.100"
        },
        body: "{ invalid json"
      });

      const response = await worker.fetch(request, env, {});
      expect(response.status).toBe(400);
      const data = (await response.json()) as any;
      expect(data.error).toBe("invalid_request");
    });

    it("should return 404 for unknown routes", async () => {
      const request = new Request("http://localhost/unknown-route");
      const response = await worker.fetch(request, env, {});

      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error).toBe("not_found");
    });
  });
});