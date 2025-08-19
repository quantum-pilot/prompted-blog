import { z } from 'zod';

export const OAuthProviderSchema = z.enum(['google', 'github']);

const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

export const PKCEChallengeSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(base64UrlPattern, 'Invalid PKCE challenge format');

export const PKCEVerifierSchema = z
  .string()
  .min(43)
  .max(128)
  .regex(base64UrlPattern, 'Invalid PKCE verifier format');

export const StateParameterSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(base64UrlPattern, 'Invalid state parameter format');

export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;