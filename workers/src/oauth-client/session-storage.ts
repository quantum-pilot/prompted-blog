// @agent: cloudflare-backend
/**
 * Storage operations for OAuth sessions and state
 */

import type { Env } from './types';
import type { SessionData } from './session-manager';
import { SessionEncryption } from './session-encryption';
import { isValidSessionId, isValidStateParameter } from './session-validation';

const SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

export class SessionStorage {
  private encryption: SessionEncryption;

  constructor(private env: Env) {
    this.encryption = new SessionEncryption(env);
  }

  async storeSession(session: SessionData, ttl: number): Promise<void> {
    const effectiveTtl = Math.min(ttl, SESSION_TTL);
    const encryptedData = await this.encryption.encrypt(JSON.stringify(session));
    
    await this.env.OAUTH_SESSIONS.put(
      `session:${session.id}`,
      encryptedData,
      { expirationTtl: effectiveTtl }
    );
  }

  async retrieveSession(sessionId: string): Promise<SessionData | null> {
    if (!isValidSessionId(sessionId)) {
      console.error('Invalid session ID format:', { length: sessionId.length });
      return null;
    }

    const encryptedData = await this.env.OAUTH_SESSIONS.get(`session:${sessionId}`);
    if (!encryptedData) return null;

    try {
      const decryptedData = await this.encryption.decrypt(encryptedData);
      return JSON.parse(decryptedData);
    } catch (error) {
      console.error('Failed to parse session:', error);
      return null;
    }
  }

  async removeSession(sessionId: string): Promise<void> {
    if (!isValidSessionId(sessionId)) {
      console.error('Invalid session ID format for deletion:', { length: sessionId.length });
      return;
    }
    await this.env.OAUTH_SESSIONS.delete(`session:${sessionId}`);
  }

  async storeOAuthState(state: string, data: any, ttl = 600): Promise<void> {
    if (!isValidStateParameter(state)) {
      console.error('Invalid state parameter format for storage:', { length: state.length });
      throw new Error('Invalid state parameter format');
    }
    
    const encryptedData = await this.encryption.encrypt(JSON.stringify(data));
    await this.env.OAUTH_SESSIONS.put(
      `state:${state}`,
      encryptedData,
      { expirationTtl: ttl }
    );
  }

  async retrieveOAuthState(state: string): Promise<any | null> {
    if (!isValidStateParameter(state)) {
      console.error('Invalid state parameter format for retrieval:', { length: state.length });
      return null;
    }
    
    const encryptedData = await this.env.OAUTH_SESSIONS.get(`state:${state}`);
    if (!encryptedData) return null;
    
    try {
      const decryptedData = await this.encryption.decrypt(encryptedData);
      const stateData = JSON.parse(decryptedData);
      await this.env.OAUTH_SESSIONS.delete(`state:${state}`);
      return stateData;
    } catch (error) {
      console.error('Failed to parse OAuth state:', error);
      await this.env.OAUTH_SESSIONS.delete(`state:${state}`);
      return null;
    }
  }
}