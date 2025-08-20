import { BaseComponent } from '../../utils/base-component.js';
import { ErrorHandler } from '../../utils/error-handler.js';
import { Router } from '../../utils/router.js';
import './admin-sidebar.module.css';

export interface MenuItem { id: string; label: string; path: string; }

export class AdminSidebar extends BaseComponent {
  private menuItems: MenuItem[] = [
    { id: 'profile', label: 'Profile', path: '/admin/profile' }
  ];
  private router?: Router;
  private routeListener?: (event: CustomEvent) => void;

  constructor() {
    super();
    // Don't render in constructor - wait for connectedCallback
  }

  connectedCallback(): void {
    // Render when connected to DOM
    if (!this.querySelector('nav')) {
      this.render();
      this.setupEventListeners();
      this.setupRouteListener();
    }
    this.updateActiveState();
  }

  disconnectedCallback(): void {
    if (this.router && this.routeListener) {
      this.router.removeEventListener('navigate', this.routeListener);
    }
    this.eventManager.cleanup();
  }

  private render(): void {
    this.setAttribute('data-desktop', 'true');
    this.setAttribute('data-mobile', 'true');
    this.innerHTML = `
      <nav aria-label="Admin navigation">
        <ul role="list">
          ${this.menuItems.map(item => `
            <li><button type="button" data-menu-item="${item.id}" 
                data-path="${item.path}" data-active="false" 
                aria-current="false">${item.label}</button></li>
          `).join('')}
        </ul>
      </nav>`;
  }

  private setupEventListeners(): void {
    this.querySelectorAll('[data-menu-item]').forEach(button => {
      const handler = async () => {
        await ErrorHandler.getInstance().wrap(
          async () => this.handleMenuClick(button as HTMLElement),
          { message: 'AdminSidebar: Menu click', code: 'ADMIN_SIDEBAR_CLICK_ERROR', context: { component: 'AdminSidebar' } }
        );
      };
      this.addManagedEventListener(button, 'click', handler as EventListener);
    });
  }

  private setupRouteListener(): void {
    if (typeof window !== 'undefined' && (window as any).router) {
      this.router = (window as any).router as Router;
      this.routeListener = (event: CustomEvent) => {
        this.updateActiveState();
      };
      this.router.addEventListener('navigate', this.routeListener);
    }
  }

  private async handleMenuClick(button: HTMLElement): Promise<void> {
    const menuItem = button.getAttribute('data-menu-item');
    const path = button.getAttribute('data-path');
    if (!menuItem || !path) return;

    this.dispatchEvent(new CustomEvent('sidebar-navigate', {
      detail: { path, menuItem },
      bubbles: true
    }));

    if (this.router) {
      await ErrorHandler.getInstance().wrap(
        async () => this.router!.navigate(path),
        { message: 'AdminSidebar: Navigation', code: 'ADMIN_SIDEBAR_NAV_ERROR', context: { path, menuItem } }
      );
    } else {
      this.handleError('Router not available', 'Navigation attempt without router', { fallback: null });
    }
  }

  private updateActiveState(): void {
    const currentPath = this.router?.getCurrentPath() || '/admin/profile';
    this.menuItems.forEach(item => {
      const button = this.querySelector(`[data-menu-item="${item.id}"]`);
      if (button) {
        const isActive = currentPath === item.path;
        button.setAttribute('data-active', String(isActive));
        button.setAttribute('aria-current', isActive ? 'page' : 'false');
      }
    });
  }
}