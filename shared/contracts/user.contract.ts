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

// Username validation: 3-30 chars, lowercase alphanumeric and hyphens only
// Cannot start/end with hyphen, no consecutive hyphens
export const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Username must be lowercase alphanumeric with hyphens (not at start/end, no consecutive)',
  });

export const UserAccountSchema = z.object({
  id: UUIDSchema,
  email: z.string().email(),
  provider: OAuthProviderSchema,
  username: UsernameSchema.optional(),
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
// Update User Profile Endpoint
// ===========================

export const UpdateUserProfileRequestSchema = z.object({
  id: UUIDSchema,
  username: UsernameSchema,
});

export const UpdateUserProfileSuccessSchema = z.object({
  success: z.literal(true),
  user: UserAccountSchema,
});

export const UpdateUserProfileErrorSchema = z.object({
  success: z.literal(false),
  error: z.enum(['username_taken', 'username_invalid', 'profile_update_failed']),
  error_description: z.string().min(1),
});

export const UpdateUserProfileResponseSchema = z.discriminatedUnion('success', [
  UpdateUserProfileSuccessSchema,
  UpdateUserProfileErrorSchema,
]);

// ===========================
// Check Username Availability Endpoint
// ===========================

export const CheckUsernameAvailabilityRequestSchema = z.object({
  username: UsernameSchema,
});

export const CheckUsernameAvailabilitySuccessSchema = z.object({
  success: z.literal(true),
  available: z.boolean(),
});

export const CheckUsernameAvailabilityErrorSchema = z.object({
  success: z.literal(false),
  error: z.enum(['username_invalid']),
  error_description: z.string().min(1),
});

export const CheckUsernameAvailabilityResponseSchema = z.discriminatedUnion('success', [
  CheckUsernameAvailabilitySuccessSchema,
  CheckUsernameAvailabilityErrorSchema,
]);

// ===========================
// Type Exports
// ===========================

export type UserAccount = z.infer<typeof UserAccountSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type CreateUserResponse = z.infer<typeof CreateUserResponseSchema>;
export type GetUserRequest = z.infer<typeof GetUserRequestSchema>;
export type GetUserResponse = z.infer<typeof GetUserResponseSchema>;
export type UpdateUserProfileRequest = z.infer<typeof UpdateUserProfileRequestSchema>;
export type UpdateUserProfileResponse = z.infer<typeof UpdateUserProfileResponseSchema>;
export type CheckUsernameAvailabilityRequest = z.infer<typeof CheckUsernameAvailabilityRequestSchema>;
export type CheckUsernameAvailabilityResponse = z.infer<typeof CheckUsernameAvailabilityResponseSchema>;
