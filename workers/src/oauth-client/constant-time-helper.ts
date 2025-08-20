// @agent: cloudflare-backend
/**
 * Helper for constant-time responses to prevent timing attacks
 */

const CONSTANT_DELAY_MS = 50;

export class ConstantTimeHelper {
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Ensures the response takes at least CONSTANT_DELAY_MS
   * to prevent timing attacks
   */
  async ensureConstantTime(): Promise<void> {
    const elapsed = Date.now() - this.startTime;
    if (elapsed < CONSTANT_DELAY_MS) {
      await new Promise(r => setTimeout(r, CONSTANT_DELAY_MS - elapsed));
    }
  }
}