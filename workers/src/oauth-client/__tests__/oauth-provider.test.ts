import { describe, it, expect } from "vitest";
import { getProvider } from "../oauth-provider";
import type { Env } from "../types";
import { RequestContext } from "../../utils/request-context";

describe("OAuth Provider Dynamic Redirect URI", () => {
  const mockEnv = {} as Env;

  it("should use localhost redirect URI for localhost requests", () => {
    const mockContext = {
      url: new URL("http://localhost:8787/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("http://localhost:8787/oauth/callback");
  });

  it("should use localhost redirect URI for 127.0.0.1 requests", () => {
    const mockContext = {
      url: new URL("http://127.0.0.1:3000/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("http://127.0.0.1:3000/oauth/callback");
  });

  it("should use https for production domain requests", () => {
    const mockContext = {
      url: new URL("https://promptedblog.com/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("https://promptedblog.com/oauth/callback");
  });

  it("should use https for custom domain requests", () => {
    const mockContext = {
      url: new URL("https://example.com/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("https://example.com/oauth/callback");
  });

  it("should handle local network IPs", () => {
    const mockContext = {
      url: new URL("http://192.168.1.100:3000/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("http://192.168.1.100:3000/oauth/callback");
  });

  it("should handle .local domains", () => {
    const mockContext = {
      url: new URL("http://mycomputer.local:8787/oauth/authorize"),
      userId: "test-user",
      correlationId: "test-correlation",
      request: {} as Request,
      log: () => {},
      errorResponse: () => new Response()
    } as RequestContext;

    const provider = getProvider("google", mockEnv, mockContext);
    
    expect(provider.redirectUri).toBe("http://mycomputer.local:8787/oauth/callback");
  });

  it("should fall back to production domain when no context provided", () => {
    const provider = getProvider("google", mockEnv);
    
    expect(provider.redirectUri).toBe("https://promptedblog.com/oauth/callback");
  });
});