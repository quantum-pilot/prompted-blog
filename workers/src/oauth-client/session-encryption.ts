// @agent: cloudflare-backend
/**
 * Encryption utilities for session management
 */

import type { Env } from "./types";

const ENCRYPTION_ALGO = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits for GCM

export class SessionEncryption {
  private encryptionKey: CryptoKey | null = null;

  constructor(private env: Env) {}

  /**
   * Derives an encryption key from the SESSION_ENCRYPTION_KEY environment variable
   */
  async getEncryptionKey(): Promise<CryptoKey> {
    if (this.encryptionKey) {
      return this.encryptionKey;
    }

    // Validate that encryption key and salt are provided
    if (!this.env.SESSION_ENCRYPTION_KEY) {
      throw new Error("SESSION_ENCRYPTION_KEY is not configured");
    }

    if (!this.env.SESSION_ENCRYPTION_SALT) {
      throw new Error("SESSION_ENCRYPTION_SALT is not configured");
    }

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.env.SESSION_ENCRYPTION_KEY),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    // Use environment-specific salt for key derivation
    // Different salts per environment (dev/staging/prod) ensure cryptographic isolation
    const salt = encoder.encode(this.env.SESSION_ENCRYPTION_SALT);

    this.encryptionKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: ENCRYPTION_ALGO, length: KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );

    return this.encryptionKey;
  }

  /**
   * Encrypts data using AES-256-GCM
   */
  async encrypt(data: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const encoder = new TextEncoder();
      const plaintext = encoder.encode(data);

      // Generate random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

      // Encrypt the data
      const ciphertext = await crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGO, iv: iv },
        key,
        plaintext
      );

      // Combine IV and ciphertext for storage
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);

      // Encode as base64 for storage
      return btoa(String.fromCharCode(...Array.from(combined)));
    } catch (error) {
      console.error("Encryption failed:", error);
      throw new Error("Failed to encrypt data");
    }
  }

  /**
   * Decrypts data using AES-256-GCM
   */
  async decrypt(encryptedData: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const decoder = new TextDecoder();

      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedData), (c) =>
        c.charCodeAt(0)
      );

      // Extract IV and ciphertext
      const iv = combined.slice(0, IV_LENGTH);
      const ciphertext = combined.slice(IV_LENGTH);

      // Decrypt the data
      const plaintext = await crypto.subtle.decrypt(
        { name: ENCRYPTION_ALGO, iv: iv },
        key,
        ciphertext
      );

      return decoder.decode(plaintext);
    } catch (error) {
      console.error("Decryption failed:", error);
      throw new Error("Failed to decrypt data");
    }
  }
}
