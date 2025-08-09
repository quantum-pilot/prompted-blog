# SEC-006: Medium - Information Disclosure in Error Messages

## Severity: MEDIUM

## Affected Files
- `/workspace/workers/src/oauth-google/handlers.ts`
- `/workspace/workers/src/oauth-google/token-exchange.ts`

## Description
The oauth-google worker exposes detailed error messages and stack traces that could reveal sensitive information about the system's internal structure, technology stack, API endpoints, and implementation details to potential attackers.

## Current Implementation
```typescript
// In handlers.ts line 76
catch (error) {
  console.error('OAuth callback error:', error);  // Logs full error details
  const message = error instanceof Error ? error.message : 'Authentication failed';
  return errorResponse(message);  // Exposes error details to client
}

// In token-exchange.ts line 46
if (!response.ok) {
  const errorData = await response.text();
  throw new Error(`Token exchange failed: ${errorData}`);  // Leaks API response
}

// Error response function
export function errorResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## Impact
- **System Information Leakage**: Error messages reveal internal implementation details
- **API Endpoint Disclosure**: External API URLs and responses exposed
- **Technology Stack Exposure**: Framework and library information in stack traces
- **Attack Surface Mapping**: Helps attackers understand system architecture
- **Debugging Information**: Development/staging details might leak to production
- **Security Through Obscurity Loss**: Reduces defense-in-depth

## Information That Could Be Exposed
1. **Internal File Paths**: `/workspace/workers/src/oauth-google/...`
2. **API Endpoints**: `https://oauth2.googleapis.com/token`
3. **Environment Variables**: Names of configuration variables
4. **Database Schemas**: If database errors are exposed
5. **Third-party Services**: Integration details with external services
6. **Version Information**: Library and framework versions
7. **Business Logic**: Implementation flow and decision points

## Remediation Required

### 1. Generic Error Messages for Production
```typescript
interface ErrorConfig {
  development: boolean;
  logErrors: boolean;
}

export class SafeErrorHandler {
  constructor(private env: Env) {}
  
  private isDevelopment(): boolean {
    return this.env.ENVIRONMENT === 'development';
  }
  
  public handleError(error: unknown, context?: string): Response {
    // Generate unique error ID for correlation
    const errorId = this.generateErrorId();
    
    // Log detailed error internally
    this.logError(error, errorId, context);
    
    // Return safe error message
    if (this.isDevelopment()) {
      return this.developmentError(error, errorId);
    } else {
      return this.productionError(errorId);
    }
  }
  
  private logError(error: unknown, errorId: string, context?: string): void {
    const logEntry = {
      errorId,
      timestamp: new Date().toISOString(),
      context,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : String(error),
    };
    
    // Log to monitoring service, not console in production
    if (!this.isDevelopment()) {
      // Send to logging service
      fetch(this.env.LOG_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(logEntry),
      }).catch(() => {
        // Fail silently to avoid recursive errors
      });
    } else {
      console.error('Error details:', logEntry);
    }
  }
  
  private productionError(errorId: string): Response {
    return new Response(
      JSON.stringify({
        error: 'An error occurred during authentication. Please try again.',
        errorId,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  private developmentError(error: unknown, errorId: string): Response {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        errorId,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
  
  private generateErrorId(): string {
    return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### 2. Categorized Error Responses
```typescript
enum ErrorCategory {
  AUTHENTICATION = 'authentication_error',
  VALIDATION = 'validation_error',
  RATE_LIMIT = 'rate_limit_error',
  SYSTEM = 'system_error',
}

const ERROR_MESSAGES: Record<ErrorCategory, string> = {
  [ErrorCategory.AUTHENTICATION]: 'Authentication failed. Please try again.',
  [ErrorCategory.VALIDATION]: 'Invalid request parameters.',
  [ErrorCategory.RATE_LIMIT]: 'Too many requests. Please try again later.',
  [ErrorCategory.SYSTEM]: 'A system error occurred. Please try again.',
};

export function categorizeError(error: unknown): ErrorCategory {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('state') || message.includes('token')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('invalid') || message.includes('validation')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('rate') || message.includes('limit')) {
      return ErrorCategory.RATE_LIMIT;
    }
  }
  
  return ErrorCategory.SYSTEM;
}

export function safeErrorResponse(error: unknown, env: Env): Response {
  const category = categorizeError(error);
  const errorId = generateErrorId();
  
  // Log internally
  logError(error, errorId, category, env);
  
  // Return generic message
  return new Response(
    JSON.stringify({
      error: ERROR_MESSAGES[category],
      errorId,
      category,
    }),
    {
      status: getStatusCode(category),
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

### 3. Updated Handler Implementation
```typescript
export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const errorHandler = new SafeErrorHandler(env);
  
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code || !state) {
      return errorHandler.handleError(
        new Error('Missing required parameters'),
        'callback-validation'
      );
    }
    
    const isValidState = await validateState(state, env);
    if (!isValidState) {
      return errorHandler.handleError(
        new Error('Invalid state parameter'),
        'state-validation'
      );
    }
    
    const tokens = await exchangeCodeForTokens(code, env);
    return handleSuccessfulAuth(tokens, env);
    
  } catch (error) {
    return errorHandler.handleError(error, 'callback-general');
  }
}
```

### 4. Secure Logging Configuration
```typescript
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  destination: 'console' | 'service' | 'both';
  sanitize: boolean;
}

export class SecureLogger {
  constructor(
    private config: LogConfig,
    private env: Env
  ) {}
  
  private sanitize(data: any): any {
    const sensitivePatterns = [
      /client_secret/gi,
      /password/gi,
      /token/gi,
      /api_key/gi,
      /authorization/gi,
    ];
    
    const json = JSON.stringify(data);
    let sanitized = json;
    
    for (const pattern of sensitivePatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }
    
    return JSON.parse(sanitized);
  }
  
  public error(message: string, error?: unknown): void {
    const logData = {
      level: 'error',
      message,
      error: error instanceof Error ? {
        message: error.message,
        name: error.name,
        stack: this.env.ENVIRONMENT === 'development' ? error.stack : undefined,
      } : error,
      timestamp: new Date().toISOString(),
    };
    
    const finalData = this.config.sanitize ? this.sanitize(logData) : logData;
    
    if (this.config.destination === 'console' || this.config.destination === 'both') {
      console.error(finalData);
    }
    
    if (this.config.destination === 'service' || this.config.destination === 'both') {
      this.sendToService(finalData);
    }
  }
  
  private async sendToService(data: any): Promise<void> {
    try {
      await fetch(this.env.LOG_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {
      // Fail silently
    }
  }
}
```

## Testing Requirements
- Verify production returns generic errors only
- Test error IDs are unique and logged
- Ensure sensitive data is never exposed
- Validate development mode shows detailed errors
- Test error categorization works correctly
- Verify logs are sanitized properly

## Best Practices
1. **Never expose stack traces** in production
2. **Use error IDs** for correlation between client and server logs
3. **Sanitize logs** before sending to external services
4. **Categorize errors** for better monitoring
5. **Rate limit error endpoints** to prevent information enumeration
6. **Monitor error patterns** for attack detection

## Compliance
- **OWASP Top 10**: A09:2021 - Security Logging and Monitoring Failures
- **CWE-209**: Information Exposure Through Error Messages
- **CWE-532**: Insertion of Sensitive Information into Log File
- **PCI DSS**: Requirement 6.5.5 - Improper error handling

## Priority
**MEDIUM** - Should be fixed before production deployment

## References
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [CWE-209: Information Exposure Through Error Messages](https://cwe.mitre.org/data/definitions/209.html)