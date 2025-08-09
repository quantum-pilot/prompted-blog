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
      const lengths = [32, 64, 128];
      lengths.forEach(length => {
        const result = generateRandomString(length);
        expect(result).toHaveLength(length);
      });
    });

    it('should generate different strings each time', () => {
      const results = new Set();
      for (let i = 0; i < 10; i++) {
        results.add(generateRandomString(32));
      }
      expect(results.size).toBe(10);
    });

    it('should only contain URL-safe characters', () => {
      const result = generateRandomString(128);
      const urlSafeRegex = /^[A-Za-z0-9\-._~]+$/;
      expect(result).toMatch(urlSafeRegex);
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

      // Challenge should have reasonable length (SHA-256 produces 256 bits = 32 bytes)
      // Base64 encoding of 32 bytes produces ~43 characters
      expect(challenge.length).toBeGreaterThan(40);
      expect(challenge.length).toBeLessThan(50);
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

    it('should handle performance requirements', async () => {
      const verifier = generateRandomString(128);
      const start = performance.now();
      await generateCodeChallenge(verifier);
      const duration = performance.now() - start;

      // PKCE operations should be fast
      expect(duration).toBeLessThan(10);
    });
  });
});
