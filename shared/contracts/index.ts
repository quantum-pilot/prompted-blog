/**
 * Contract Schema Barrel Export
 * Central export point for all API contract schemas
 */

// OAuth base schemas and types
export {
  OAuthProviderSchema,
  PKCEChallengeSchema,
  PKCEVerifierSchema,
  StateParameterSchema,
  type OAuthProvider,
} from './oauth-base.contract';

// OAuth authorize contract schemas and types
export {
  OAuthAuthorizeRequestSchema,
  OAuthAuthorizeSuccessSchema,
  OAuthAuthorizeErrorSchema,
  OAuthAuthorizeResponseSchema,
  AuthorizeRouteSchema,
  type OAuthAuthorizeRequest,
  type OAuthAuthorizeResponse,
  type AuthorizeRouteInput,
} from './oauth-authorize.contract';

// Add inferred types for schemas
import type { z } from 'zod';
import {
  OAuthAuthorizeSuccessSchema as _OAuthAuthorizeSuccessSchema,
  OAuthAuthorizeErrorSchema as _OAuthAuthorizeErrorSchema,
} from './oauth-authorize.contract';
export type OAuthAuthorizeSuccess = z.infer<typeof _OAuthAuthorizeSuccessSchema>;
export type OAuthAuthorizeError = z.infer<typeof _OAuthAuthorizeErrorSchema>;

// OAuth callback contract schemas and types
export {
  OAuthCallbackRequestSchema,
  OAuthCallbackSuccessSchema,
  OAuthCallbackErrorSchema,
  OAuthCallbackResponseSchema,
  CallbackRouteSchema,
  type OAuthCallbackRequest,
  type OAuthCallbackResponse,
  type CallbackRouteInput,
} from './oauth-callback.contract';

// Add inferred types for callback schemas
import {
  OAuthCallbackSuccessSchema as _OAuthCallbackSuccessSchema,
  OAuthCallbackErrorSchema as _OAuthCallbackErrorSchema,
} from './oauth-callback.contract';
export type OAuthCallbackSuccess = z.infer<typeof _OAuthCallbackSuccessSchema>;
export type OAuthCallbackError = z.infer<typeof _OAuthCallbackErrorSchema>;

// Session contract schemas and types
export {
  SessionIdSchema,
  BearerTokenSchema,
  SessionValidationHeadersSchema,
  SessionValidationSuccessSchema,
  SessionValidationErrorSchema,
  SessionValidationResponseSchema,
  OAuthSessionSchema,
  PKCEChallengeDataSchema,
  type SessionId,
  type SessionValidationHeaders,
  type SessionValidationResponse,
  type OAuthSession,
  type PKCEChallengeData,
} from './session.contract';

// Add inferred types for session schemas
import {
  SessionValidationSuccessSchema as _SessionValidationSuccessSchema,
  SessionValidationErrorSchema as _SessionValidationErrorSchema,
} from './session.contract';
export type SessionValidationSuccess = z.infer<typeof _SessionValidationSuccessSchema>;
export type SessionValidationError = z.infer<typeof _SessionValidationErrorSchema>;

// Health check contract schemas and types
export {
  HealthCheckResponseSchema,
  HealthCheckErrorSchema,
  HealthResponseSchema,
  type HealthCheckResponse,
  type HealthCheckError,
  type HealthResponse,
} from './health.contract';

// User account contract schemas and types
export {
  UsernameSchema,
  UserAccountSchema,
  CreateUserRequestSchema,
  CreateUserSuccessSchema,
  CreateUserErrorSchema,
  CreateUserResponseSchema,
  GetUserRequestSchema,
  GetUserSuccessSchema,
  GetUserErrorSchema,
  GetUserResponseSchema,
  UpdateUserProfileRequestSchema,
  UpdateUserProfileSuccessSchema,
  UpdateUserProfileErrorSchema,
  UpdateUserProfileResponseSchema,
  CheckUsernameAvailabilityRequestSchema,
  CheckUsernameAvailabilitySuccessSchema,
  CheckUsernameAvailabilityErrorSchema,
  CheckUsernameAvailabilityResponseSchema,
  type UserAccount,
  type CreateUserRequest,
  type CreateUserResponse,
  type GetUserRequest,
  type GetUserResponse,
  type UpdateUserProfileRequest,
  type UpdateUserProfileResponse,
  type CheckUsernameAvailabilityRequest,
  type CheckUsernameAvailabilityResponse,
} from './user.contract';

// Alias exports for compatibility with existing test expectations
export {
  AuthorizeRouteSchema as authorizeRequestSchema,
  OAuthAuthorizeResponseSchema as authorizeResponseSchema,
  type OAuthAuthorizeRequest as AuthorizeRequest,
  type OAuthAuthorizeResponse as AuthorizeResponse,
} from './oauth-authorize.contract';

export {
  CallbackRouteSchema as callbackRequestSchema,
  OAuthCallbackResponseSchema as callbackResponseSchema,
  type OAuthCallbackRequest as CallbackRequest,
  type OAuthCallbackResponse as CallbackResponse,
} from './oauth-callback.contract';

export {
  SessionValidationResponseSchema as sessionValidationResponseSchema,
} from './session.contract';