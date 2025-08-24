import { OAuthErrorType } from './oauth-client';

/**
 * OAuth Error class for handling authentication errors
 */
export class OAuthError extends Error {
  constructor(
    public readonly type: OAuthErrorType,
    public readonly userMessage: string,
    public readonly technicalMessage: string,
    public readonly retryable: boolean,
    public readonly originalError?: Error
  ) {
    super(userMessage);
    this.name = 'OAuthError';
  }
}