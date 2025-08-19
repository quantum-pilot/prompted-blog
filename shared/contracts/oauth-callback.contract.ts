/**
 * OAuth Callback Endpoint Contract Schemas
 * Contract-first API schemas for OAuth callback handling using Zod
 */

import { z } from 'zod';
import { OAuthProviderSchema, PKCEVerifierSchema, StateParameterSchema } from './oauth-base.contract';

// ===========================
// OAuth Callback Endpoint
// ===========================

export const OAuthCallbackRequestSchema = z.object({
  code: z.string().min(1).max(512),
  state: StateParameterSchema,
  code_verifier: PKCEVerifierSchema,
  provider: OAuthProviderSchema.optional(),
});

export const OAuthCallbackSuccessSchema = z.object({
  success: z.literal(true),
  sessionId: z.string().min(32).max(128),
  user: z.object({
    email: z.string().email(),
    name: z.string().optional(),
    picture: z.string().url().optional(),
  }),
});

export const OAuthCallbackErrorSchema = z.object({
  success: z.literal(false),
  error: z.string().min(1),
  error_description: z.string().min(1),
});

export const OAuthCallbackResponseSchema = z.discriminatedUnion('success', [
  OAuthCallbackSuccessSchema,
  OAuthCallbackErrorSchema,
]);

// ===========================
// Hono RPC Route Schema
// ===========================

// For POST requests with JSON body
export const CallbackRouteSchema = z.object({
  body: OAuthCallbackRequestSchema,
});

// ===========================
// Type Exports
// ===========================

export type OAuthCallbackRequest = z.infer<typeof OAuthCallbackRequestSchema>;
export type OAuthCallbackResponse = z.infer<typeof OAuthCallbackResponseSchema>;
export type CallbackRouteInput = z.infer<typeof CallbackRouteSchema>;