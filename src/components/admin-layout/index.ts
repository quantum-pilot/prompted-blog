import { BaseComponent } from "../../utils/base-component.js";
import { ErrorHandler } from "../../utils/error-handler.js";
import './admin-layout.module.css';

export interface MenuToggleEvent extends CustomEvent {
  detail: { isOpen: boolean };
}

export class AdminLayout extends BaseComponent {
  private isMenuOpen = false;
  private toggleButton: HTMLButtonElement | null = null;

  constructor() {
    super();
    // Don't render in constructor - wait for connectedCallback
  }

  connectedCallback(): void {
    // Render when connected to DOM
    ErrorHandler.getInstance().wrap(async () => this.init(), {
      message: "AdminLayout: initialization",
      code: "ADMIN_LAYOUT_INIT_ERROR",
      context: { component: "AdminLayout" }
    });
  }

  private async init(): Promise<void> {
    this.render();
    this.setupEventListeners();
    this.updateMenuState();
  }

  private render(): void {
    // Don't clear children - preserve slotted content
    this.setAttribute('data-responsive', 'true');
    
    // Check if wrapper already exists (avoid re-rendering)
    if (this.querySelector('[data-layout-wrapper]')) {
      return;
    }
    
    // Save existing slotted children
    const sidebarContent = this.querySelector('[slot="sidebar"]');
    const mainContent = this.querySelector('[slot="content"]');
    
    // Clear and create wrapper structure
    while (this.firstChild) this.removeChild(this.firstChild);
    
    const wrapper = this.createElement('div', { 'data-layout-wrapper': '' });
    
    this.toggleButton = this.createElement('button', {
      'data-menu-toggle': '',
      'data-mobile-only': '',
      'aria-label': 'Toggle menu',
      'type': 'button'
    });
    this.toggleButton.textContent = '☰';
    
    const sidebarWrapper = this.createElement('aside', { 'data-sidebar-wrapper': '' });
    const sidebarSlot = document.createElement('slot');
    sidebarSlot.setAttribute('name', 'sidebar');
    sidebarWrapper.appendChild(sidebarSlot);
    
    const contentWrapper = this.createElement('main', { 'data-content-wrapper': '' });
    const contentSlot = document.createElement('slot');
    contentSlot.setAttribute('name', 'content');
    contentWrapper.appendChild(contentSlot);
    
    wrapper.append(this.toggleButton, sidebarWrapper, contentWrapper);
    this.appendChild(wrapper);
    
    // Re-append slotted content if it existed
    if (sidebarContent) this.appendChild(sidebarContent);
    if (mainContent) this.appendChild(mainContent);
  }

  private createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attrs: Record<string, string> = {}
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, val]) => {
      if (val === '') {
        // For boolean attributes, just set the attribute without a value
        el.setAttribute(key, '');
      } else {
        el.setAttribute(key, val);
      }
    });
    return el;
  }

  private setupEventListeners(): void {
    if (!this.toggleButton) return;
    this.eventManager.addEventListener(this.toggleButton, 'click', async () => {
      await ErrorHandler.getInstance().wrap(async () => this.handleMenuToggle(), {
        message: "AdminLayout: menu toggle",
        code: "ADMIN_LAYOUT_TOGGLE_ERROR",
        context: { component: "AdminLayout" }
      });
    });
  }

  private handleMenuToggle(): void {
    this.isMenuOpen = !this.isMenuOpen;
    this.updateMenuState();
    this.dispatchEvent(new CustomEvent('menu-toggle', {
      detail: { isOpen: this.isMenuOpen },
      bubbles: true,
      composed: true
    }) as MenuToggleEvent);
  }

  private updateMenuState(): void {
    this.setAttribute('data-menu-open', String(this.isMenuOpen));
  }

  disconnectedCallback(): void {
    this.eventManager.cleanup();
  }
}