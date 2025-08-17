import { BaseComponent } from "../../utils/base-component.js";
import { OAuthProvider, OAUTH_PROVIDERS } from "@app/shared";

export interface OAuthStartEvent extends CustomEvent {
  detail: {
    provider: OAuthProvider;
  };
}

export class OAuthFlowStart extends BaseComponent {
  constructor() {
    super();
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    // Clear existing content
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }

    // Create container
    const container = document.createElement('div');
    container.className = 'oauth-buttons';

    // Create button
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.provider = 'google';
    button.className = 'oauth-button oauth-button--google';
    button.textContent = 'Sign in with Google';

    // Append elements
    container.appendChild(button);
    this.appendChild(container);
  }

  private setupEventListeners(): void {
    const button = this.querySelector(
      '[data-provider="google"]'
    ) as HTMLButtonElement;
    if (button) {
      const handleClick = this.handleButtonClick.bind(
        this,
        OAuthProvider.Google
      );
      this.addManagedEventListener(button, "click", handleClick);
    }
  }

  private handleButtonClick(provider: OAuthProvider): void {
    const event: OAuthStartEvent = new CustomEvent("oauth-start", {
      detail: { provider },
      bubbles: true,
      cancelable: true,
    });

    this.dispatchEvent(event);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}
