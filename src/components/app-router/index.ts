import { BaseComponent } from "../../utils/base-component.js";
import { Router, NavigationEvent } from "../../utils/router.js";
import { ErrorHandler } from "../../utils/error-handler.js";
import './app-router.module.css';

export interface RouteChangeEvent extends CustomEvent {
  detail: NavigationEvent;
}

export interface RouteNotFoundEvent extends CustomEvent {
  detail: {
    path: string;
  };
}

export class AppRouter extends BaseComponent {
  private router: Router;
  private navigationHandler: ((event: CustomEvent<NavigationEvent>) => void) | null = null;

  constructor() {
    super();
    this.router = new Router();
    ErrorHandler.getInstance().wrap(
      async () => this.init(),
      {
        message: "AppRouter: initialization",
        code: "APP_ROUTER_INIT_ERROR",
        context: { component: "AppRouter" }
      }
    );
  }

  private async init(): Promise<void> {
    this.render();
    this.setupRouterListeners();
    this.updateDataRoute(this.router.getCurrentPath());
  }

  private render(): void {
    // Clear existing content
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }

    // Create slot for route-specific content
    const slot = document.createElement('slot');
    this.appendChild(slot);
  }

  private setupRouterListeners(): void {
    // Create navigation handler
    this.navigationHandler = (event: CustomEvent<NavigationEvent>) => {
      const { path, params, query } = event.detail;
      
      // Update data-route attribute
      this.updateDataRoute(path);
      
      // Dispatch custom route-change event
      const routeChangeEvent: RouteChangeEvent = new CustomEvent('route-change', {
        detail: { path, params, query },
        bubbles: true,
        cancelable: true
      });
      
      this.dispatchEvent(routeChangeEvent);
    };

    // Add listener to router
    this.router.addEventListener('navigate', this.navigationHandler);
  }

  private updateDataRoute(path: string): void {
    this.setAttribute('data-route', path);
  }

  public handleRouteNotFound(path: string): void {
    const notFoundEvent: RouteNotFoundEvent = new CustomEvent('route-not-found', {
      detail: { path },
      bubbles: true,
      cancelable: true
    });
    
    this.dispatchEvent(notFoundEvent);
  }

  disconnectedCallback(): void {
    // Remove router listener
    if (this.navigationHandler) {
      this.router.removeEventListener('navigate', this.navigationHandler);
    }
    
    // Call parent cleanup
    super.disconnectedCallback();
  }
}