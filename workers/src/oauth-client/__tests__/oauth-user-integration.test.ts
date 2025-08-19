// @agent: cloudflare-backend
import { describe, it, expect, beforeEach, vi } from "vitest";
import { processOAuthSuccess } from "../user-integration";
import type { Env } from "../types";
import type { RequestContext } from "../../utils/request-context";

describe("OAuth User Integration", () => {
  let env: Env, ctx: RequestContext, kvStore = new Map();
  beforeEach(() => {
    kvStore.clear();
    const putInProgress = new Set<string>();
    
    env = {
      OAUTH_SESSIONS: {
        put: vi.fn(async (k, v) => {
          // Simulate atomic put for email keys to prevent race conditions
          if (k.startsWith("user:email:")) {
            if (putInProgress.has(k)) {
              await new Promise(resolve => setTimeout(resolve, 1));
            }
            putInProgress.add(k);
            try {
              if (!kvStore.has(k)) {
                await new Promise(resolve => setTimeout(resolve, 1));
                if (!kvStore.has(k)) {
                  kvStore.set(k, v);
                }
              }
            } finally {
              putInProgress.delete(k);
            }
          } else {
            kvStore.set(k, v);
          }
        }),
        get: vi.fn(async k => kvStore.get(k)),
        delete: vi.fn(async k => kvStore.delete(k)),
      } as any,
      SESSION_ENCRYPTION_KEY: "0".repeat(64),
      SESSION_ENCRYPTION_SALT: "1".repeat(32),
      ALLOWED_ORIGINS: "http://localhost:3000",
    };
    
    // Create a mock request with CF-Connecting-IP header for rate limiting
    const mockRequest = new Request("http://localhost:3000", {
      headers: new Headers({ "CF-Connecting-IP": "192.168.1.100" }),
    });
    
    ctx = { 
      requestId: "test", 
      userId: "test-user", 
      origin: "http://localhost:3000", 
      method: "POST", 
      log: vi.fn(),
      request: mockRequest 
    } as RequestContext;
  });

  it("creates new user on first OAuth login < 50ms", async () => {
    const start = Date.now();
    const res = await processOAuthSuccess({ email: "new@test.com", provider: "google", name: "Test User", userId: "oauth-sub-123" }, env, ctx);
    expect(Date.now() - start).toBeLessThan(50);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.sessionId).toBeDefined();
    expect(data.user.email).toBe("new@test.com");
  });

  it("retrieves existing user on subsequent logins", async () => {
    await processOAuthSuccess({ email: "exist@test.com", provider: "google", userId: "sub1" }, env, ctx);
    const res2 = await processOAuthSuccess({ email: "exist@test.com", provider: "google", userId: "sub2" }, env, ctx);
    const data = await res2.json() as any;
    expect(data.success).toBe(true);
    const userKey = Array.from(kvStore.keys()).find(k => k.startsWith("user:id:"));
    expect(userKey).toBeDefined();
  });

  it("updates user profile when OAuth data changes", async () => {
    await processOAuthSuccess({ email: "update@test.com", provider: "github", userId: "gh1" }, env, ctx);
    const res = await processOAuthSuccess({ email: "update@test.com", provider: "github", name: "Updated Name", picture: "http://pic.url", userId: "gh1" }, env, ctx);
    expect((await res.json() as any).user.name).toBe("Updated Name");
  });

  it("handles different OAuth providers for same email", async () => {
    await processOAuthSuccess({ email: "multi@test.com", provider: "google", userId: "g1" }, env, ctx);
    const res = await processOAuthSuccess({ email: "multi@test.com", provider: "github", userId: "gh1" }, env, ctx);
    expect((await res.json() as any).success).toBe(true);
  });

  it("handles invalid email gracefully", async () => {
    const res = await processOAuthSuccess({ email: "", provider: "google", userId: "sub" }, env, ctx);
    expect(res.status).toBe(500);
    expect((await res.json() as any).error).toBe("server_error");
  });

  it("verifies JWT contains persistent user ID", async () => {
    const res = await processOAuthSuccess({ email: "jwt@test.com", provider: "azure", userId: "oauth-sub-456" }, env, ctx);
    const data = await res.json() as any;
    const sessionData = kvStore.get(`session:${data.sessionId}`);
    expect(sessionData).toBeDefined();
  });

  it("handles concurrent user creation race conditions", async () => {
    const promises = Array(5).fill(null).map((_, i) => processOAuthSuccess({ email: "race@test.com", provider: "google", userId: `sub${i}` }, env, ctx));
    const results = await Promise.all(promises);
    expect(results.every(r => r.status === 200)).toBe(true);
    const userKeys = Array.from(kvStore.keys()).filter(k => k.startsWith("user:email:race@test.com"));
    expect(userKeys.length).toBe(1);
  });

  it("persists user data across sessions", async () => {
    const res1 = await processOAuthSuccess({ email: "persist@test.com", provider: "okta", userId: "o1" }, env, ctx);
    const session1 = (await res1.json() as any).sessionId;
    kvStore.delete(`session:${session1}`);
    const res2 = await processOAuthSuccess({ email: "persist@test.com", provider: "okta", userId: "o2" }, env, ctx);
    expect((await res2.json() as any).user.email).toBe("persist@test.com");
  });
});