/**
 * Session Contract Schema Definitions
 * Contract-first API schemas for session management using Zod
 */

import { z } from 'zod';
import { OAuthProviderSchema } from './oauth-base.contract';

// ===========================
// Session ID Validation
// ===========================

export const SessionIdSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid session ID format');

export const BearerTokenSchema = z
  .string()
  .regex(/^Bearer\s+[A-Za-z0-9_-]+$/, 'Invalid Authorization header format');

// ===========================
// Session Validation Endpoint
// ===========================

export const SessionValidationHeadersSchema = z.object({
  authorization: BearerTokenSchema,
});

export const SessionValidationSuccessSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  provider: OAuthProviderSchema,
  expiresAt: z.number().int().positive(),
});

export const SessionValidationErrorSchema = z.object({
  error: z.enum([
    'invalid_request',
    'session_not_found',
    'session_expired',
    'unauthorized',
  ]),
  error_description: z.string().min(1),
});

export const SessionValidationResponseSchema = z.union([
  SessionValidationSuccessSchema,
  SessionValidationErrorSchema,
]);

// ===========================
// Session Data Models
// ===========================

export const OAuthSessionSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  provider: OAuthProviderSchema,
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  state: z.string().min(32).max(128),
});

export const PKCEChallengeDataSchema = z.object({
  challenge: z.string().min(43).max(128),
  state: z.string().min(32).max(128),
  provider: OAuthProviderSchema,
  createdAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
});

// ===========================
// Type Exports
// ===========================

export type SessionId = z.infer<typeof SessionIdSchema>;
export type SessionValidationHeaders = z.infer<typeof SessionValidationHeadersSchema>;
export type SessionValidationResponse = z.infer<typeof SessionValidationResponseSchema>;
export type OAuthSession = z.infer<typeof OAuthSessionSchema>;
export type PKCEChallengeData = z.infer<typeof PKCEChallengeDataSchema>;