import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  sha256,
  base64urlEncode,
  generateCodeChallenge
} from '../pkce';

describe('PKCE Utilities', () => {
  describe('generateRandomString', () => {
    it('should generate string of correct length', () => {
      const lengths = [43, 64, 128]; // Include min length (43) per RFC 7636
      lengths.forEach(length => {
        const result = generateRandomString(length);
        expect(result).toHaveLength(length);
      });
    });

    it('should generate different strings each time', () => {
      const results = new Set();
      for (let i = 0; i < 100; i++) { // More iterations for better uniqueness test
        results.add(generateRandomString(64));
      }
      expect(results.size).toBe(100);
    });

    it('should only contain URL-safe characters', () => {
      const result = generateRandomString(128);
      // RFC 7636 unreserved characters: [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      const urlSafeRegex = /^[A-Za-z0-9\-._~]+$/;
      expect(result).toMatch(urlSafeRegex);
    });

    it('should handle minimum PKCE verifier length (43 chars)', () => {
      const result = generateRandomString(43);
      expect(result).toHaveLength(43);
      expect(result).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('should handle maximum PKCE verifier length (128 chars)', () => {
      const result = generateRandomString(128);
      expect(result).toHaveLength(128);
      expect(result).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });

    it('should complete within 50ms', () => {
      const start = performance.now();
      generateRandomString(128);
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
    });
  });

  describe('sha256', () => {
    it('should generate consistent hash for same input', async () => {
      const input = 'test-string';
      const hash1 = await sha256(input);
      const hash2 = await sha256(input);

      expect(hash1).toEqual(hash2);
    });

    it('should generate different hashes for different inputs', async () => {
      const hash1 = await sha256('input1');
      const hash2 = await sha256('input2');

      // Convert ArrayBuffers to hex strings for comparison
      const hex1 = Array.from(new Uint8Array(hash1))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const hex2 = Array.from(new Uint8Array(hash2))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      expect(hex1).not.toBe(hex2);
    });
  });

  describe('base64urlEncode', () => {
    it('should encode buffer to base64url format', () => {
      const text = 'test string';
      const encoder = new TextEncoder();
      const buffer = encoder.encode(text);

      const result = base64urlEncode(buffer);

      // Should not contain standard base64 characters that are not URL-safe
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
      expect(result).not.toContain('=');
    });

    it('should produce URL-safe output', () => {
      const buffer = new Uint8Array([255, 254, 253, 252, 251]);
      const result = base64urlEncode(buffer);

      // Result should be URL-safe
      const urlSafeRegex = /^[A-Za-z0-9\-_]+$/;
      expect(result).toMatch(urlSafeRegex);
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate valid PKCE code challenge', async () => {
      const verifier = generateRandomString(128);
      const challenge = await generateCodeChallenge(verifier);

      // Challenge should be base64url encoded
      const urlSafeRegex = /^[A-Za-z0-9\-_]+$/;
      expect(challenge).toMatch(urlSafeRegex);

      // SHA-256 produces 256 bits = 32 bytes
      // Base64url encoding of 32 bytes produces exactly 43 characters (no padding)
      expect(challenge).toHaveLength(43);
    });

    it('should generate consistent challenge for same verifier', async () => {
      const verifier = 'test-verifier-123';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const challenge1 = await generateCodeChallenge('verifier1');
      const challenge2 = await generateCodeChallenge('verifier2');

      expect(challenge1).not.toBe(challenge2);
    });

    it('should handle RFC 7636 test vector', async () => {
      // Test vector from RFC 7636 Appendix B
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toBe(expectedChallenge);
    });

    it('should handle minimum length verifier', async () => {
      const verifier = generateRandomString(43);
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('should handle maximum length verifier', async () => {
      const verifier = generateRandomString(128);
      const challenge = await generateCodeChallenge(verifier);
      
      expect(challenge).toHaveLength(43); // Always 43 chars regardless of input
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    });

    it('should complete within 50ms', async () => {
      const verifier = generateRandomString(128);
      const start = performance.now();
      await generateCodeChallenge(verifier);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(50);
    });
  });

  describe('PKCE Flow Integration', () => {
    it('should generate valid PKCE pair for OAuth flow', async () => {
      // Generate verifier with recommended length
      const verifier = generateRandomString(64);
      expect(verifier).toHaveLength(64);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
      
      // Generate challenge from verifier
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      
      // Verify they are different (challenge is hashed)
      expect(verifier).not.toBe(challenge);
    });

    it('should complete full PKCE generation within 50ms', async () => {
      const start = performance.now();
      
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(50);
      expect(verifier).toBeTruthy();
      expect(challenge).toBeTruthy();
    });

    it('should handle PKCE without client_secret', async () => {
      // This test verifies PKCE can work without client_secret
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      
      // In a real OAuth flow:
      // 1. Send challenge in authorization request
      // 2. Send verifier in token exchange
      // 3. No client_secret needed
      
      expect(verifier).toBeTruthy();
      expect(challenge).toBeTruthy();
      expect(verifier).not.toBe(challenge);
    });
  });
});
