import { BaseComponent } from '../../utils/base-component';

export interface OAuthStartEvent extends CustomEvent {
  detail: {
    provider: 'openai' | 'claude';
  };
}

export type OAuthProvider = 'openai' | 'claude';

export class OAuthFlowStart extends BaseComponent {
  constructor() {
    super();
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.innerHTML = `
      <div class="oauth-buttons">
        <button type="button" data-provider="openai" class="oauth-button oauth-button--openai">
          Sign in with OpenAI
        </button>
        <button type="button" data-provider="claude" class="oauth-button oauth-button--claude">
          Sign in with Claude
        </button>
      </div>
    `;
  }

  private setupEventListeners(): void {
    const providers: OAuthProvider[] = ['openai', 'claude'];
    
    providers.forEach(provider => {
      const button = this.querySelector(`[data-provider="${provider}"]`) as HTMLButtonElement;
      if (button) {
        const handleClick = this.handleButtonClick.bind(this, provider);
        this.addManagedEventListener(button, 'click', handleClick);
      }
    });
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