/**
 * Shared constants used by both frontend and worker
 */

// Application configuration
export const APP_CONFIG = {
  DOMAIN: "promptedblog.com",
  OAUTH_CALLBACK_PATH: "/oauth-callback",
} as const;


// Helper function to get redirect URI
export function getRedirectUri(protocol: 'http' | 'https' = 'https'): string {
  return `${protocol}://${APP_CONFIG.DOMAIN}${APP_CONFIG.OAUTH_CALLBACK_PATH}`;
}

// OAuth Providers configuration
export const OAUTH_PROVIDERS = {
  google: {
    name: "Google",
    clientId: "200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com",
    authServer: "https://accounts.google.com",
    authPath: "/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
    additionalParams: {
      'access_type': 'online',
      'prompt': 'select_account'
    }
  },
  github: {
    name: "GitHub",
    clientId: "", // Add when GitHub OAuth is configured
    authServer: "https://github.com",
    authPath: "/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email"],
    additionalParams: {}
  },
} as const;

// Helper function to get full authorization URL
export function getAuthorizationUrl(provider: 'google' | 'github'): string {
  return `${OAUTH_PROVIDERS[provider].authServer}${OAUTH_PROVIDERS[provider].authPath}`;
}

// Note: HTTP Status codes have been moved to shared/api/http.ts
// Import HttpStatus enum from shared/api/index or shared/index
