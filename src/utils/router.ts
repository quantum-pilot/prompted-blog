import { RouteParams, matchRoute, parseQueryParams } from './route-matcher';

export interface NavigationEvent {
  path: string;
  params: RouteParams;
  query?: string;
}

export interface NavigateOptions {
  force?: boolean;
  replace?: boolean;
}

type RouteHandler = (event: NavigationEvent) => void;
type NavigationListener = (event: CustomEvent<NavigationEvent>) => void;

interface RouteEntry {
  pattern: string;
  handler: RouteHandler;
}

export { RouteParams } from './route-matcher';

export class Router {
  private routes: RouteEntry[] = [];
  private listeners: Map<string, Set<NavigationListener>> = new Map();
  private popstateHandler: (event: PopStateEvent) => void;
  private currentPath: string = '';

  constructor() {
    this.currentPath = window.location.pathname;
    
    // Handle browser back/forward navigation
    this.popstateHandler = (event: PopStateEvent) => {
      const path = event.state?.path || window.location.pathname;
      this.currentPath = path;
      this.handleNavigation(path, {}, window.location.search.slice(1));
    };
    
    window.addEventListener('popstate', this.popstateHandler);
  }


  /**
   * Navigate to a path
   */
  navigate(path: string, options: NavigateOptions = {}): void {
    const [pathname, search] = path.split('?');
    const normalizedPath = pathname.replace(/\/$/, '') || '/';
    
    // Skip if navigating to same path unless forced
    if (!options.force && normalizedPath === this.currentPath && 
        window.location.search === (search ? `?${search}` : '')) {
      return;
    }
    
    this.currentPath = normalizedPath;
    
    // Update browser history
    const url = search ? `${normalizedPath}?${search}` : normalizedPath;
    if (options.replace) {
      window.history.replaceState({ path: normalizedPath }, '', url);
    } else {
      window.history.pushState({ path: normalizedPath }, '', url);
    }
    
    // Handle navigation
    this.handleNavigation(normalizedPath, {}, search);
  }

  /**
   * Add a route handler
   */
  addRoute(pattern: string, handler: RouteHandler): () => void {
    const entry: RouteEntry = { pattern, handler };
    this.routes.push(entry);
    
    // Return unsubscribe function
    return () => {
      const index = this.routes.indexOf(entry);
      if (index !== -1) {
        this.routes.splice(index, 1);
      }
    };
  }

  /**
   * Add event listener for navigation events
   */
  addEventListener(event: string, listener: NavigationListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(event: string, listener: NavigationListener): void {
    this.listeners.get(event)?.delete(listener);
  }

  /**
   * Get current path
   */
  getCurrentPath(): string {
    return window.location.pathname;
  }

  /**
   * Parse and return query parameters
   */
  getQueryParams(): RouteParams {
    return parseQueryParams(window.location.search);
  }

  /**
   * Clean up router
   */
  destroy(): void {
    window.removeEventListener('popstate', this.popstateHandler);
    this.routes = [];
    this.listeners.clear();
  }

  /**
   * Handle navigation and emit events
   */
  private handleNavigation(path: string, params: RouteParams, search?: string): void {
    const navigationEvent: NavigationEvent = {
      path,
      params,
      ...(search && { query: search })
    };
    
    // Emit navigation event
    const event = new CustomEvent('navigate', { detail: navigationEvent });
    this.listeners.get('navigate')?.forEach(listener => listener(event));
    
    // Check registered routes
    for (const route of this.routes) {
      const match = matchRoute(route.pattern, path);
      if (match.matched) {
        route.handler({
          path,
          params: match.params,
          ...(search && { query: search })
        });
      }
    }
  }
}