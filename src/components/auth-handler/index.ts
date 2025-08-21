import { BaseComponent } from "../../utils/base-component.js";
import { ErrorHandler } from "../../utils/error-handler.js";
import { ProfileClient } from "../../api/profile-client.js";
import type { GetUserResponse } from "@app/shared/contracts";

export interface UsernameReadyEvent extends CustomEvent {
  detail: {
    username: string;
  };
}

export class AuthHandler extends BaseComponent {
  private profileClient: ProfileClient;

  constructor() {
    super();
    this.profileClient = new ProfileClient();
    this.init();
  }

  private init(): void {
    ErrorHandler.getInstance().wrap(() => {
      this.checkAuthenticationStatus();
      this.setupEventListeners();
    }, {
      message: "AuthHandler: initialization",
      code: "AUTH_HANDLER_INIT_ERROR",
      context: { component: "AuthHandler" }
    });
  }

  private async checkAuthenticationStatus(): Promise<void> {
    try {
      // Try to get profile - cookies will be sent automatically
      const response: GetUserResponse = await this.profileClient.getProfile();
      
      if (response.success && response.user.username) {
        this.routeToAdmin(response.user.username);
      }
      // If not authenticated or no username, do nothing
    } catch (error) {
      this.handleError(error, "checkAuthenticationStatus");
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
      
      if (hostname === "localhost") {
        // Local development - route to /admin without subdomain
        window.location.assign("/admin");
      } else {
        // Production - route to username subdomain
        const adminUrl = `https://${username}.promptedblog.com/admin/`;
        window.location.assign(adminUrl);
      }
    }, {
      message: "AuthHandler: route to admin",
      code: "AUTH_HANDLER_ROUTE_ERROR",
      context: { component: "AuthHandler", username }
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}