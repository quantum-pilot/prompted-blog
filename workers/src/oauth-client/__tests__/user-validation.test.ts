// @agent: cloudflare-backend
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validateUserAccount, UserAccountSchema, AllowedMetadataSchema, sanitizeUserInput, UsernameSchema } from "../user-validation";

describe("User Validation", () => {
  describe("AllowedMetadataSchema", () => {
    it("should only allow specific metadata fields", () => {
      const validMetadata = {
        provider: "google",
        lastLoginAt: new Date().toISOString(),
        loginCount: 5
      };
      expect(() => AllowedMetadataSchema.parse(validMetadata)).not.toThrow();
    });

    it("should reject arbitrary metadata fields", () => {
      const invalidMetadata = {
        provider: "google",
        arbitraryField: "should not be allowed",
        injection: "<script>alert('xss')</script>"
      };
      expect(() => AllowedMetadataSchema.parse(invalidMetadata)).toThrow();
    });

    it("should enforce string length limits on provider", () => {
      const longProvider = "a".repeat(101);
      const invalidMetadata = { provider: longProvider };
      expect(() => AllowedMetadataSchema.parse(invalidMetadata)).toThrow();
    });

    it("should validate loginCount as positive integer", () => {
      expect(() => AllowedMetadataSchema.parse({ loginCount: -1 })).toThrow();
      expect(() => AllowedMetadataSchema.parse({ loginCount: 1.5 })).toThrow();
      expect(() => AllowedMetadataSchema.parse({ loginCount: 0 })).not.toThrow();
    });

    it("should validate lastLoginAt as ISO date string", () => {
      expect(() => AllowedMetadataSchema.parse({ 
        lastLoginAt: "not-a-date" 
      })).toThrow();
      expect(() => AllowedMetadataSchema.parse({ 
        lastLoginAt: new Date().toISOString() 
      })).not.toThrow();
    });
  });

  describe("UsernameSchema", () => {
    it("should validate correct usernames", () => {
      const validUsernames = ['abc', 'myuser123', 'john-doe', 'test-user-123', 'a'.repeat(30)];
      validUsernames.forEach(username => {
        expect(() => UsernameSchema.parse(username)).not.toThrow();
      });
    });

    it("should reject invalid usernames", () => {
      const invalidUsernames = [
        'ab', // too short
        'a'.repeat(31), // too long
        'User123', // uppercase
        '-test', // starts with hyphen
        'test-', // ends with hyphen
        'test--user', // consecutive hyphens
        'test_user', // underscore
        'test user', // space
        'test@user', // special char
      ];
      invalidUsernames.forEach(username => {
        expect(() => UsernameSchema.parse(username)).toThrow();
      });
    });
  });

  describe("UserAccountSchema", () => {
    it("should validate complete user account", () => {
      const validUser = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        name: "Test User",
        picture: "https://example.com/pic.jpg",
        createdAt: new Date().toISOString(),
        metadata: { provider: "google" }
      };
      expect(() => UserAccountSchema.parse(validUser)).not.toThrow();
    });

    it("should validate user account with username", () => {
      const validUser = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        username: "john-doe",
        createdAt: new Date().toISOString()
      };
      expect(() => UserAccountSchema.parse(validUser)).not.toThrow();
    });

    it("should enforce email format validation", () => {
      const invalidUser = {
        id: crypto.randomUUID(),
        email: "not-an-email",
        createdAt: new Date().toISOString()
      };
      expect(() => UserAccountSchema.parse(invalidUser)).toThrow();
    });

    it("should enforce field length limits", () => {
      const longString = "a".repeat(1001);
      const invalidUser = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        name: longString,
        createdAt: new Date().toISOString()
      };
      expect(() => UserAccountSchema.parse(invalidUser)).toThrow();
    });

    it("should enforce URL format for picture", () => {
      const invalidUser = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        picture: "not-a-url",
        createdAt: new Date().toISOString()
      };
      expect(() => UserAccountSchema.parse(invalidUser)).toThrow();
    });

    it("should require critical fields", () => {
      expect(() => UserAccountSchema.parse({})).toThrow();
      expect(() => UserAccountSchema.parse({ id: "123" })).toThrow();
      expect(() => UserAccountSchema.parse({ 
        id: "123", 
        email: "test@example.com" 
      })).toThrow(); // missing createdAt
    });
  });

  describe("validateUserAccount", () => {
    it("should return validated user for valid input", () => {
      const input = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        metadata: { provider: "github" }
      };
      const result = validateUserAccount(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
      }
    });

    it("should return error for invalid input", () => {
      const input = {
        id: "123",
        email: "invalid",
        metadata: { arbitrary: "data" }
      };
      const result = validateUserAccount(input);
      expect(result.success).toBe(false);
    });

    it("should handle latency requirement", () => {
      const start = performance.now();
      const input = {
        id: crypto.randomUUID(),
        email: "user@example.com",
        createdAt: new Date().toISOString(),
        metadata: { provider: "google", loginCount: 10 }
      };
      validateUserAccount(input);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });

  describe("sanitizeUserInput", () => {
    it("should include username when provided", () => {
      const input = {
        email: "user@example.com",
        username: "john-doe",
        provider: "google"
      };
      const result = sanitizeUserInput(input);
      expect(result.username).toBe("john-doe");
    });

    it("should validate username format", () => {
      const input = {
        email: "user@example.com",
        username: "Invalid-Username", // uppercase not allowed
        provider: "google"
      };
      expect(() => sanitizeUserInput(input)).toThrow("Username must be lowercase alphanumeric");
    });

    it("should handle optional username", () => {
      const input = {
        email: "user@example.com",
        provider: "google"
      };
      const result = sanitizeUserInput(input);
      expect(result.username).toBeUndefined();
    });
  });
});