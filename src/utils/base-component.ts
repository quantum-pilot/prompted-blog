import { ErrorHandler } from './error-handler';
import { EventManager } from './event-manager';

/**
 * Base class for web components that provides:
 * - Centralized service initialization
 * - Event management with automatic cleanup
 * - Error handling integration
 * - Consistent lifecycle management
 */
export abstract class BaseComponent extends HTMLElement {
  protected errorHandler: ErrorHandler;
  protected eventManager: EventManager;

  constructor() {
    super();
    this.errorHandler = ErrorHandler.getInstance();
    this.eventManager = new EventManager();
  }

  disconnectedCallback(): void {
    this.eventManager.cleanup();
    this.cleanup();
  }

  protected cleanup(): void {
    // Subclasses can override for additional cleanup
  }

  protected addManagedEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventManager.addEventListener(element, event, handler, options);
  }

  protected removeManagedEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventManager.removeEventListener(element, event, handler, options);
  }

  protected handleError(
    error: Error | string,
    operation: string,
    config?: { fallback?: any }
  ): any {
    return this.errorHandler.handle(error, {
      message: `${this.constructor.name}: ${operation}`,
      code: 'COMPONENT_ERROR',
      context: { component: this.constructor.name }
    }, {
      logToConsole: true,
      fallbackValue: config?.fallback ?? null
    });
  }
}