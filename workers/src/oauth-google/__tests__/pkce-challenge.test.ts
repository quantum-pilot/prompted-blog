// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { generateRandomString, generateCodeChallenge } from '../pkce';
import { measurePerformance, assertLatency } from './test-helpers';

describe('PKCE Code Challenge', () => {
  describe('generateCodeChallenge', () => {
    it('should generate valid PKCE code challenge', async () => {
      const verifier = generateRandomString(128);
      const challenge = await generateCodeChallenge(verifier);
      const urlSafeRegex = /^[A-Za-z0-9\-_]+$/;
      expect(challenge).toMatch(urlSafeRegex);
      expect(challenge).toHaveLength(43); // SHA-256 -> base64url = 43 chars
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
      const { duration } = await measurePerformance(() => generateCodeChallenge(verifier));
      assertLatency(duration);
    });
  });

  describe('PKCE Flow Integration', () => {
    it('should generate valid PKCE pair for OAuth flow', async () => {
      const verifier = generateRandomString(64);
      expect(verifier).toHaveLength(64);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);

      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(verifier).not.toBe(challenge); // Verify they are different (challenge is hashed)
    });

    it('should complete full PKCE generation within 50ms', async () => {
      const { result, duration } = await measurePerformance(async () => {
        const verifier = generateRandomString(64);
        const challenge = await generateCodeChallenge(verifier);
        return { verifier, challenge };
      });
      assertLatency(duration);
      expect(result.verifier).toBeTruthy();
      expect(result.challenge).toBeTruthy();
    });

    it('should handle PKCE without client_secret', async () => {
      // Verifies PKCE can work without client_secret (OAuth 2.0 public clients)
      const verifier = generateRandomString(64);
      const challenge = await generateCodeChallenge(verifier);
      // In real flow: 1) Send challenge in auth request 2) Send verifier in token exchange
      expect(verifier).toBeTruthy();
      expect(challenge).toBeTruthy();
      expect(verifier).not.toBe(challenge);
    });
  });
});
