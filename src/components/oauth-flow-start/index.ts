import { BaseComponent } from '../../utils/base-component.js';
import { OAuthProvider, OAUTH_PROVIDERS } from '@app/shared';

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
    this.innerHTML = `
      <div class="oauth-buttons">
        <button type="button" data-provider="google" class="oauth-button oauth-button--google">
          Sign in with Google
        </button>
      </div>
    `;
  }

  private setupEventListeners(): void {
    const button = this.querySelector('[data-provider="google"]') as HTMLButtonElement;
    if (button) {
      const handleClick = this.handleButtonClick.bind(this, OAuthProvider.Google);
      this.addManagedEventListener(button, 'click', handleClick);
    }
  }

  private handleButtonClick(provider: OAuthProvider): void {
    const event: OAuthStartEvent = new CustomEvent('oauth-start', {
      detail: { provider },
      bubbles: true,
      cancelable: true
    });

    this.dispatchEvent(event);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }
}
