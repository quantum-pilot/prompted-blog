import { BaseComponent } from "../../utils/base-component.js";
import { ErrorHandler } from "../../utils/error-handler.js";
import { authState } from "../../auth-state.js";

export interface UsernameReadyEvent extends CustomEvent {
  detail: {
    username: string;
  };
}

export class AuthHandler extends BaseComponent {
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super();
    this.init();
  }

  private init(): void {
    ErrorHandler.getInstance().wrap(() => {
      this.setupEventListeners();
      
      // Subscribe to auth state changes
      this.unsubscribe = authState.subscribe((state) => {
        if (state.isAuthenticated && state.user?.username) {
          this.routeToAdmin(state.user.username);
        }
      });
      
      // Check current state
      const state = authState.getState();
      if (state.isAuthenticated && state.user?.username) {
        this.routeToAdmin(state.user.username);
      }
      
      // Trigger auth check if not already done
      authState.checkAuthStatus();
    }, {
      message: "AuthHandler: initialization",
      code: "AUTH_HANDLER_INIT_ERROR",
      context: { component: "AuthHandler" }
    });
  }

  protected disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private setupEventListeners(): void {
    const handleUsernameReady = this.handleUsernameReady.bind(this);
    this.addManagedEventListener(
      window,
      "username-ready",
      handleUsernameReady
    );
  }

  private handleUsernameReady(event: Event): void {
    const customEvent = event as UsernameReadyEvent;
    const username = customEvent.detail?.username;
    
    if (username) {
      this.routeToAdmin(username);
    }
  }

  private routeToAdmin(username: string): void {
    ErrorHandler.getInstance().wrap(() => {
      const hostname = window.location.hostname;
      const port = window.location.port;
      
      // Check if we're in local development
      if (hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.") || hostname.endsWith(".local")) {
        // Local development - route to /admin without subdomain
        window.location.assign("/admin");
      } else {
        // Production/staging - route to username subdomain using current domain
        // Extract the root domain (remove any existing subdomain)
        const domainParts = hostname.split('.');
        const rootDomain = domainParts.length > 2 
          ? domainParts.slice(-2).join('.') // Get last two parts (e.g., promptedblog.com)
          : hostname; // Use as-is if it's already root domain
        
        // Build URL with username subdomain
        const protocol = window.location.protocol;
        const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : '';
        const adminUrl = `${protocol}//${username}.${rootDomain}${portSuffix}/admin/`;
        window.location.assign(adminUrl);
      }
    }, {
      message: "AuthHandler: route to admin",
      code: "AUTH_HANDLER_ROUTE_ERROR",
      context: { component: "AuthHandler", username }
    });
  }

}