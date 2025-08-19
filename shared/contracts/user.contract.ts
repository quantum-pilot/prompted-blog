/**
 * User Account Contract Schema Definitions
 * Contract-first API schemas for user account management using Zod
 * 
 * Usage example:
 * ```typescript
 * // Validate create request
 * const request = { email: 'user@example.com', provider: 'google' };
 * const validated = CreateUserRequestSchema.parse(request);
 * 
 * // Validate response
 * const response = { success: true, user: {...} };
 * const validatedResponse = CreateUserResponseSchema.parse(response);
 * ```
 */

import { z } from 'zod';
import { OAuthProviderSchema } from './oauth-base.contract';

// ===========================
// User Account Schema
// ===========================

const UUIDSchema = z.string().uuid();

export const UserAccountSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  provider: OAuthProviderSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

// ===========================
// Create User Endpoint
// ===========================

export const CreateUserRequestSchema = z.object({
  email: z.string().email(),
  provider: OAuthProviderSchema,
});

export const CreateUserSuccessSchema = z.object({
  success: z.literal(true),
  user: UserAccountSchema,
});

export const CreateUserErrorSchema = z.object({
  success: z.literal(false),
  error: z.enum(['user_exists', 'invalid_request', 'internal_error']),
  error_description: z.string().min(1),
});

export const CreateUserResponseSchema = z.discriminatedUnion('success', [
  CreateUserSuccessSchema,
  CreateUserErrorSchema,
]);

// ===========================
// Get User Endpoint
// ===========================

export const GetUserRequestSchema = z
  .object({
    email: z.string().email().optional(),
    id: UUIDSchema.optional(),
  })
  .refine(
    (data) => data.email || data.id,
    { message: 'Either email or id must be provided' }
  );

export const GetUserSuccessSchema = z.object({
  success: z.literal(true),
  user: UserAccountSchema,
});

export const GetUserErrorSchema = z.object({
  success: z.literal(false),
  error: z.enum(['user_not_found', 'invalid_request', 'internal_error']),
  error_description: z.string().min(1),
});

export const GetUserResponseSchema = z.discriminatedUnion('success', [
  GetUserSuccessSchema,
  GetUserErrorSchema,
]);

// ===========================
// Type Exports
// ===========================

export type UserAccount = z.infer<typeof UserAccountSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;
export type GetUserRequest = z.infer<typeof GetUserRequestSchema>;
export type GetUserResponse = z.infer<typeof GetUserResponseSchema>;