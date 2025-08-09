// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import {
  generateRandomString,
  sha256,
  base64urlEncode
} from '../pkce';
import { measurePerformance, assertLatency } from './test-helpers';

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

    it('should complete within 50ms', async () => {
      const { duration } = await measurePerformance(() => generateRandomString(128));
      assertLatency(duration);
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
});
