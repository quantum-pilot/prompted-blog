// @agent: cloudflare-backend
export interface SanitizeOptions {
  allowKnownErrors?: boolean;
  includeCode?: boolean;
}

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  /[\w.-]+@[\w.-]+\.\w+/gi, // Email addresses
  /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, // UUIDs
  /\b(user|id|session|token)[-_][\w]{6,}\b/gi, // IDs
  /\b(bearer|token|key|secret|password|api[-_]?key|access[-_]?token|refresh[-_]?token)[\s:=]*[\w.-]+/gi,
  /\b(sk|pk|api)[-_](test|live|prod)[-_][\w]+/gi, // API keys
  /https?:\/\/[^\s]+[?&](key|token|secret|password|api_key|access_token)=[^&\s]+/gi,
  /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, // JWT tokens
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit cards
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
];

const SAFE_ERROR_MESSAGES = new Set([
  'Network timeout', 'Connection refused', 'Service unavailable', 
  'Invalid input', 'Rate limit exceeded', 'Unauthorized',
  'Forbidden', 'Not found', 'Bad request', 'Internal error',
]);

/** Sanitizes error messages to prevent sensitive information disclosure */
export function sanitizeError(
  error: unknown,
  operation: string,
  options: SanitizeOptions = {}
): string {
  const baseMessage = `${operation}_FAILED`;

  // Handle null/undefined
  if (error == null) {
    return baseMessage;
  }

  // Handle non-object errors
  if (typeof error !== 'object') {
    return baseMessage;
  }

  try {
    // Extract message and code safely
    let message = '';
    let code = '';

    if (error instanceof Error) {
      message = error.message || '';
      code = (error as any).code || '';
    } else if (typeof (error as any).message === 'string') {
      message = (error as any).message;
      code = (error as any).code || '';
    }

    // Check if this is a known safe error message
    if (options.allowKnownErrors && SAFE_ERROR_MESSAGES.has(message)) {
      return `${baseMessage}: ${message}`;
    }

    // Check for sensitive data in message
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(message) || pattern.test(code)) {
        return baseMessage;
      }
    }

    // Include error code if requested and safe
    if (options.includeCode && code) {
      // Check if code contains sensitive data
      let codeSafe = true;
      for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(code)) {
          codeSafe = false;
          break;
        }
      }
      
      if (codeSafe && /^[A-Z_]+$/.test(code)) {
        return `${baseMessage} [${code}]`;
      }
    }

    return baseMessage;
  } catch {
    // If any error occurs during sanitization, return the base message
    return baseMessage;
  }
}