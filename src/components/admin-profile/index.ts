import { BaseComponent } from '../../utils/base-component';

export class AdminProfile extends BaseComponent {
  private usernameInput!: HTMLInputElement;
  private emailInput!: HTMLInputElement;

  static get observedAttributes() {
    return ['username', 'email'];
  }

  constructor() {
    super();
    this.init();
  }

  private init(): void {
    this.attachShadow({ mode: 'open' });
    this.render();
    this.setAttribute('data-component', 'admin-profile');
  }

  private render(): void {
    if (!this.shadowRoot) return;

    // Create structure without user data to avoid XSS
    this.shadowRoot.innerHTML = `
      <style>
        @import url('./admin-profile.module.css');
      </style>
      <div data-profile-container>
        <h2>User Profile</h2>
        <div class="form-group">
          <label for="username">Username</label>
          <input 
            type="text" 
            id="username" 
            name="username" 
            disabled
          />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input 
            type="text" 
            id="email" 
            name="email" 
            disabled
          />
        </div>
      </div>
    `;

    this.usernameInput = this.shadowRoot.querySelector('input[name="username"]')!;
    this.emailInput = this.shadowRoot.querySelector('input[name="email"]')!;
    
    // Set values safely using DOM properties
    const username = this.getAttribute('username');
    const email = this.getAttribute('email');
    
    if (username) {
      this.usernameInput.value = username;
    }
    
    if (email) {
      this.emailInput.value = email;
    }
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue) return;

    if (name === 'username' && this.usernameInput) {
      this.usernameInput.value = newValue || '';
    } else if (name === 'email' && this.emailInput) {
      this.emailInput.value = newValue || '';
    }
  }

  get username(): string {
    return this.getAttribute('username') || '';
  }

  set username(value: string) {
    this.setAttribute('username', value);
  }

  get email(): string {
    return this.getAttribute('email') || '';
  }

  set email(value: string) {
    this.setAttribute('email', value);
  }

  disconnectedCallback(): void {
    this.eventManager.cleanup();
  }
}

customElements.define('admin-profile', AdminProfile);