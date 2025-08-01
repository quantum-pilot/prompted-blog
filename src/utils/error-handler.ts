export interface ErrorDetails {
  message: string;
  code?: string;
  context?: Record<string, any>;
  originalError?: Error;
}

export interface ErrorHandlerConfig {
  showUserMessage?: boolean;
  logToConsole?: boolean;
  fallbackValue?: any;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorContainer: HTMLElement | null = null;

  private constructor() {
    this.initErrorUI();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  private initErrorUI(): void {
    // Create a hidden error container for user feedback
    const container = document.createElement('div');
    container.id = 'error-container';
    container.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
      border-radius: 4px;
      padding: 0.75rem 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 9999;
      display: none;
      max-width: 400px;
      font-size: 0.9rem;
    `;
    document.body.appendChild(container);
    this.errorContainer = container;
  }

  /**
   * Handle an error with standardized logging and optional user feedback
   */
  handle(error: Error | string, details: ErrorDetails, config: ErrorHandlerConfig = {}): any {
    const {
      showUserMessage = false,
      logToConsole = true,
      fallbackValue = null
    } = config;

    const errorMessage = typeof error === 'string' ? error : error.message;
    const fullMessage = `${details.message}: ${errorMessage}`;
    
    // Console logging
    if (logToConsole) {
      console.error(fullMessage, {
        code: details.code,
        context: details.context,
        originalError: typeof error === 'string' ? new Error(error) : error
      });
    }

    // User feedback
    if (showUserMessage) {
      this.showUserError(details.message);
    }

    return fallbackValue;
  }

  /**
   * Handle API errors specifically
   */
  handleApiError(error: Error | string, operation: string, context?: Record<string, any>): any {
    return this.handle(error, {
      message: `API operation failed: ${operation}`,
      code: 'API_ERROR',
      context
    }, {
      showUserMessage: true,
      logToConsole: true,
      fallbackValue: null
    });
  }

  /**
   * Handle rendering errors
   */
  handleRenderError(error: Error | string, component: string, fallback: string = 'Failed to render content.'): string {
    return this.handle(error, {
      message: `Rendering failed in ${component}`,
      code: 'RENDER_ERROR'
    }, {
      showUserMessage: false,
      logToConsole: true,
      fallbackValue: fallback
    });
  }

  /**
   * Handle navigation errors
   */
  handleNavigationError(error: Error | string, operation: string): void {
    this.handle(error, {
      message: `Navigation failed: ${operation}`,
      code: 'NAVIGATION_ERROR'
    }, {
      showUserMessage: true,
      logToConsole: true
    });
  }

  /**
   * Show error message to user
   */
  private showUserError(message: string): void {
    if (!this.errorContainer) return;

    this.errorContainer.textContent = message;
    this.errorContainer.style.display = 'block';

    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (this.errorContainer) {
        this.errorContainer.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Manually hide error message
   */
  hideUserError(): void {
    if (this.errorContainer) {
      this.errorContainer.style.display = 'none';
    }
  }

  /**
   * Async wrapper that handles errors consistently
   */
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

  /**
   * Cleanup method
   */
  cleanup(): void {
    if (this.errorContainer && this.errorContainer.parentNode) {
      this.errorContainer.parentNode.removeChild(this.errorContainer);
      this.errorContainer = null;
    }
  }
}