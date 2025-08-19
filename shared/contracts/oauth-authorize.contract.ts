/**
 * OAuth Authorize Endpoint Contract Schemas
 * Contract-first API schemas for OAuth authorization using Zod
 */

import { z } from 'zod';
import { OAuthProviderSchema, PKCEChallengeSchema, StateParameterSchema } from './oauth-base.contract';

// ===========================
// OAuth Authorize Endpoint
// ===========================

export const OAuthAuthorizeRequestSchema = z.object({
  code_challenge: PKCEChallengeSchema,
  state: StateParameterSchema,
  provider: OAuthProviderSchema,
});

export const OAuthAuthorizeSuccessSchema = z.object({
  success: z.literal(true),
  authorizationUrl: z.string().url(),
});

export const OAuthAuthorizeErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
  error_description: z.string().min(1),
});

export const OAuthAuthorizeResponseSchema = z.discriminatedUnion('success', [
  OAuthAuthorizeSuccessSchema,
  OAuthAuthorizeErrorSchema,
]);

// ===========================
// Hono RPC Route Schema
// ===========================

// For GET requests with query parameters
export const AuthorizeRouteSchema = z.object({
  query: OAuthAuthorizeRequestSchema,
});

// ===========================
// Type Exports
// ===========================

export type OAuthAuthorizeRequest = z.infer<typeof OAuthAuthorizeRequestSchema>;
export type OAuthAuthorizeResponse = z.infer<typeof OAuthAuthorizeResponseSchema>;
export type AuthorizeRouteInput = z.infer<typeof AuthorizeRouteSchema>;