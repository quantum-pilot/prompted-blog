// @agent: cloudflare-backend
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditDataAccess, DataAccessContext } from "../data-access-decorator";
import { AuditLogger } from "../audit-logger";
import { RequestContext } from "../request-context";

vi.mock("../audit-logger", () => ({
  AuditLogger: { logDataAccess: vi.fn() }
}));

describe("Data Access Decorator", () => {
  let consoleWarnSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  const applyDecorator = (
    method: any,
    resource: string,
    methodName: string
  ) => {
    const descriptor = { value: method, configurable: true, writable: true };
    return auditDataAccess(resource)({}, methodName, descriptor);
  };

  it("should log successful sync method execution", async () => {
    const requestContext = new RequestContext();
    requestContext.userId = "user123";
    const originalMethod = vi.fn((context: DataAccessContext) => ({
      id: context.requestContext.userId,
      name: "Test User"
    }));
    const modifiedDescriptor = applyDecorator(
      originalMethod,
      "UserData",
      "getUser"
    );
    const context: DataAccessContext = {
      requestContext,
      resource: "user-profile",
      operation: "read"
    };

    const result = await modifiedDescriptor.value(context);

    expect(result).toEqual({ id: "user123", name: "Test User" });
    expect(originalMethod).toHaveBeenCalledWith(context);
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      "user123",
      "UserData.getUser",
      "read",
      true
    );
  });

  it("should log successful async method execution", async () => {
    const requestContext = new RequestContext();
    requestContext.userId = "user456";
    requestContext.sessionId = "session789";
    const originalMethod = vi.fn(
      async (context: DataAccessContext, data: any) => ({
        success: true,
        userId: context.requestContext.userId
      })
    );
    const modifiedDescriptor = applyDecorator(
      originalMethod,
      "UserData",
      "updateUser"
    );
    const context: DataAccessContext = {
      requestContext,
      resource: "user-profile",
      operation: "write"
    };

    const result = await modifiedDescriptor.value(context, { name: "Updated" });

    expect(result).toEqual({ success: true, userId: "user456" });
    expect(originalMethod).toHaveBeenCalledWith(context, { name: "Updated" });
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      "user456",
      "UserData.updateUser",
      "write",
      true
    );
  });

  it("should log failed method execution and rethrow error", async () => {
    const originalMethod = vi.fn(async () => {
      throw new Error("Access denied");
    });
    const modifiedDescriptor = applyDecorator(
      originalMethod,
      "SecureData",
      "deleteItem"
    );
    const requestContext = new RequestContext();
    requestContext.userId = "user789";
    const context: DataAccessContext = {
      requestContext,
      resource: "secure-item",
      operation: "delete"
    };

    await expect(modifiedDescriptor.value(context)).rejects.toThrow(
      "Access denied"
    );

    expect(originalMethod).toHaveBeenCalledWith(context);
    expect(AuditLogger.logDataAccess).toHaveBeenCalledWith(
      "user789",
      "SecureData.deleteItem",
      "delete",
      false
    );
  });

  it("should warn and skip logging when context is missing", async () => {
    const originalMethod = vi.fn(() => "data");
    const modifiedDescriptor = applyDecorator(
      originalMethod,
      "TestData",
      "getData"
    );

    const result = await modifiedDescriptor.value("no-context");

    expect(result).toBe("data");
    expect(originalMethod).toHaveBeenCalledWith("no-context");
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Missing audit context for TestData.getData"
    );
    expect(AuditLogger.logDataAccess).not.toHaveBeenCalled();
  });
});
