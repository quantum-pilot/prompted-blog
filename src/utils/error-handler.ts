import { createSingleton } from './singleton';

export interface ErrorDetails {
  message: string;
  code?: string;
  context?: Record<string, any>;
  originalError?: Error;
}

export interface ErrorHandlerConfig {
  logToConsole?: boolean;
  fallbackValue?: any;
}

export class ErrorHandler {
  static getInstance = createSingleton<ErrorHandler>(ErrorHandler);

  handle(error: Error | string, details: ErrorDetails, config: ErrorHandlerConfig = {}): any {
    const {
      logToConsole = true,
      fallbackValue = null
    } = config;

    const errorMessage = typeof error === 'string' ? error : error.message;
    const fullMessage = `${details.message}: ${errorMessage}`;

    if (logToConsole) {
      console.error(fullMessage, {
        code: details.code,
        context: details.context,
        originalError: typeof error === 'string' ? new Error(error) : error
      });
    }

    return fallbackValue;
  }

  async wrap<T>(
    operation: () => Promise<T>, 
    errorDetails: ErrorDetails, 
    config: ErrorHandlerConfig = {}
  ): Promise<T | any> {
    try {
      return await operation();
    } catch (error) {
      return this.handle(error as Error, errorDetails, config);
    }
  }
}