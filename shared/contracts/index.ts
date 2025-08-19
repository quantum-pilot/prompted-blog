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

// Health check contract schemas and types
export {
  HealthCheckResponseSchema,
  HealthCheckErrorSchema,
  HealthResponseSchema,
  type HealthCheckResponse,
  type HealthCheckError,
  type HealthResponse,
} from './health.contract';

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