import { ApiService } from '../services/api-service.js';
import { DiffRenderer } from '../services/diff-renderer.js';
import { UrlService } from '../services/url-service.js';
import { AppCoordinator } from '../services/app-coordinator.js';
import { ErrorHandler } from './error-handler.js';
import { EventManager } from './event-manager.js';

/**
 * Base class for web components that provides:
 * - Centralized service initialization
 * - Event management with automatic cleanup
 * - Error handling integration
 * - Consistent lifecycle management
 */
export abstract class BaseComponent extends HTMLElement {
  protected apiService: ApiService;
  protected diffRenderer: DiffRenderer;
  protected urlService: UrlService;
  protected appCoordinator: AppCoordinator;
  protected errorHandler: ErrorHandler;
  protected eventManager: EventManager;

  constructor() {
    super();
    
    // Initialize all services
    this.apiService = ApiService.getInstance();
    this.diffRenderer = DiffRenderer; // Static class, no getInstance needed
    this.urlService = UrlService.getInstance();
    this.appCoordinator = AppCoordinator.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.eventManager = new EventManager();
  }

  /**
   * Standard cleanup for all components
   */
  disconnectedCallback(): void {
    this.eventManager.cleanup();
    this.cleanup();
  }

  /**
   * Override this method for component-specific cleanup
   */
  protected cleanup(): void {
    // Subclasses can override for additional cleanup
  }

  /**
   * Add event listener through the event manager for automatic cleanup
   */
  protected addManagedEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventManager.addEventListener(element, event, handler, options);
  }

  /**
   * Remove event listener through the event manager
   */
  protected removeManagedEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    this.eventManager.removeEventListener(element, event, handler, options);
  }

  /**
   * Convenience method for handling errors with context
   */
  protected handleError(
    error: Error | string,
    operation: string,
    config?: { showUser?: boolean; fallback?: any }
  ): any {
    return this.errorHandler.handle(error, {
      message: `${this.constructor.name}: ${operation}`,
      code: 'COMPONENT_ERROR',
      context: { component: this.constructor.name }
    }, {
      showUserMessage: config?.showUser ?? false,
      logToConsole: true,
      fallbackValue: config?.fallback ?? null
    });
  }

  /**
   * Common setVisible implementation for all components
   */
  public setVisible(visible: boolean): void {
    this.style.display = visible ? 'block' : 'none';
  }

  /**
   * Common checkHistoryMode implementation for components that hide in non-history mode
   */
  protected checkHistoryMode(): void {
    this.setVisible(this.urlService.isHistoryEnabled());
  }
}