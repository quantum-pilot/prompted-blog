// @agent: cloudflare-backend
import { describe, it, expect } from 'vitest';
import { getAllowedOrigins, getCorsHeaders } from '../cors';
import type { Env } from '../types';

describe('CORS Configuration', () => {
  describe('getAllowedOrigins', () => {
    it('should return production domain when no env variable is set', () => {
      const origins = getAllowedOrigins();
      expect(origins).toEqual(['https://promptedblog.com']);
    });

    it('should return production domain when env is undefined', () => {
      const origins = getAllowedOrigins(undefined);
      expect(origins).toEqual(['https://promptedblog.com']);
    });

    it('should parse comma-separated origins from environment variable', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'https://example.com,https://app.example.com,https://staging.example.com',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const origins = getAllowedOrigins(mockEnv);
      expect(origins).toEqual([
        'https://example.com',
        'https://app.example.com',
        'https://staging.example.com'
      ]);
    });

    it('should trim whitespace from origins', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: ' https://example.com , https://app.example.com ',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const origins = getAllowedOrigins(mockEnv);
      expect(origins).toEqual([
        'https://example.com',
        'https://app.example.com'
      ]);
    });

    it('should handle single origin', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'https://example.com',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const origins = getAllowedOrigins(mockEnv);
      expect(origins).toEqual(['https://example.com']);
    });
  });

  describe('getCorsHeaders', () => {
    it('should not include origin header when origin is not in allowed list', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'https://example.com',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const headers = getCorsHeaders('https://malicious.com', undefined, mockEnv);
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
      expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST, OPTIONS');
    });

    it('should include origin header when origin is in allowed list', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'https://example.com,https://app.example.com',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const headers = getCorsHeaders('https://example.com', undefined, mockEnv);
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should handle null origin', () => {
      const mockEnv: Env = {
        ALLOWED_ORIGINS: 'https://example.com',
        OAUTH_SESSIONS: {} as any,
        OAUTH_KV: {} as any,
        GOOGLE_CLIENT_ID: 'test',
        CLIENT_ID: 'test',
        REDIRECT_URI: 'test',
        FRONTEND_URL: 'test',
        SESSION_ENCRYPTION_KEY: 'test'
      };
      
      const headers = getCorsHeaders(null, undefined, mockEnv);
      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
    });
  });
});