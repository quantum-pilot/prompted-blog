// @agent: cloudflare-backend
// Utilities for extracting information from HTTP headers

export function extractCorrelationId(request: Request, stateParam?: string | null): string | undefined {
  // Priority: state parameter > header
  if (stateParam) {
    return stateParam;
  }
  return request.headers.get('X-Correlation-ID') || undefined;
}

export function extractIpAddress(request: Request): string | undefined {
  return request.headers.get('CF-Connecting-IP') || undefined;
}

export function extractUserAgent(request: Request): string | undefined {
  return request.headers.get('User-Agent') || undefined;
}

export function extractSessionIdFromCookie(request: Request): string | undefined {
  const cookies = request.headers.get('Cookie');
  if (!cookies) return undefined;

  const sessionCookie = cookies.split(';')
    .find(c => c.trim().startsWith('session='));
  
  if (sessionCookie) {
    return sessionCookie.split('=')[1].trim();
  }
  
  return undefined;
}

export interface JWTPayload {
  sub?: string;
  id?: string;
  email?: string;
}

export function extractUserInfoFromJWT(request: Request): JWTPayload | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(atob(parts[1]));
    return {
      sub: payload.sub,
      id: payload.id,
      email: payload.email
    };
  } catch {
    // Invalid JWT - return null
    return null;
  }
}

export function setPropagationHeaders(request: Request, context: {
  correlationId: string;
  userId?: string;
  sessionId?: string;
}): Request {
  const headers = new Headers(request.headers);
  headers.set('X-Correlation-ID', context.correlationId);
  if (context.userId) headers.set('X-User-ID', context.userId);
  if (context.sessionId) headers.set('X-Session-ID', context.sessionId);

  return new Request(request, { headers });
}