/**
 * Shared constants used by both frontend and worker
 */

// OAuth Client IDs (public values)
export const OAUTH_CLIENT_IDS = {
  GOOGLE:
    "200871674285-39ni3ek941gka7tp7a4894eg7noe9ude.apps.googleusercontent.com",
  GITHUB: "",
} as const;

// OAuth Providers configuration
export const OAUTH_PROVIDERS = {
  google: {
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  },
  github: {
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
  },
} as const;

// OAuth Scopes
export const OAUTH_SCOPES = {
  GOOGLE: ["openid", "email", "profile"],
  GITHUB: ["read:user", "user:email"],
} as const;

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
