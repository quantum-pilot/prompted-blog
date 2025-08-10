// @agent: cloudflare-backend
// Data access audit middleware for HTTP endpoints

import type { KVNamespace, KVNamespacePutOptions } from '@cloudflare/workers-types';
import { AuditLogger } from './audit-logger';

/**
 * Example usage in a KV store access pattern
 */
export class AuditedKVStore {
  constructor(private kv: KVNamespace) {}

  getKV(): KVNamespace {
    return this.kv;
  }

  async get(key: string, userId: string): Promise<any> {
    try {
      const value = await this.kv.get(key);
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'read', true);
      return value;
    } catch (error) {
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'read', false);
      throw error;
    }
  }

  async put(key: string, value: string, userId: string, options?: KVNamespacePutOptions): Promise<void> {
    try {
      await this.kv.put(key, value, options);
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'write', true);
    } catch (error) {
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'write', false);
      throw error;
    }
  }

  async delete(key: string, userId: string): Promise<void> {
    try {
      await this.kv.delete(key);
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'delete', true);
    } catch (error) {
      AuditLogger.logDataAccess(userId, `KVStore.${key}`, 'delete', false);
      throw error;
    }
  }
}
