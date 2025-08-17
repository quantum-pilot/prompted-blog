import { ErrorHandler } from "./error-handler.js";
import { EventManager } from "./event-manager.js";

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

  protected cleanup(): void {}

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
    return this.errorHandler.handle(
      error,
      {
        message: `${this.constructor.name}: ${operation}`,
        code: "COMPONENT_ERROR",
        context: { component: this.constructor.name },
      },
      {
        logToConsole: true,
        fallbackValue: config?.fallback ?? null,
      }
    );
  }
}
