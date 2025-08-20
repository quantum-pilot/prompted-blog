import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminSidebar } from '../index';
import { Router } from '../../../utils/router';

describe('AdminSidebar', () => {
  let element: AdminSidebar;
  let router: Router;

  beforeEach(() => {
    router = new Router();
    vi.spyOn(router, 'navigate');
    vi.spyOn(router, 'getCurrentPath').mockReturnValue('/admin/profile');
    (window as any).router = router;

    if (!customElements.get('admin-sidebar')) {
      customElements.define('admin-sidebar', AdminSidebar);
    }
    element = document.createElement('admin-sidebar') as AdminSidebar;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element?.remove();
    vi.clearAllMocks();
    delete (window as any).router;
  });

  it('extends BaseComponent and uses EventManager', () => {
    expect(element).toBeInstanceOf(HTMLElement);
    const cleanupSpy = vi.spyOn(element['eventManager'], 'cleanup');
    element.disconnectedCallback();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('renders navigation menu with Profile section link', () => {
    const nav = element.querySelector('nav');
    const profileLink = element.querySelector('[data-menu-item="profile"]');
    expect(nav).toBeTruthy();
    expect(profileLink).toBeTruthy();
    expect(profileLink?.textContent?.trim()).toBe('Profile');
  });

  it('tracks active menu item with data-active attribute', () => {
    const profileLink = element.querySelector('[data-menu-item="profile"]');
    expect(profileLink?.getAttribute('data-active')).toBe('true');
  });

  it('dispatches navigation event when menu item is clicked', () => {
    const spy = vi.fn();
    element.addEventListener('sidebar-navigate', spy);
    const profileLink = element.querySelector('[data-menu-item="profile"]') as HTMLElement;
    profileLink?.click();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'sidebar-navigate',
      detail: expect.objectContaining({ path: '/admin/profile', menuItem: 'profile' })
    }));
  });

  it('listens to route changes to update active state', () => {
    const profileLink = element.querySelector('[data-menu-item="profile"]');
    expect(profileLink?.getAttribute('data-active')).toBe('true');
    
    vi.spyOn(router, 'getCurrentPath').mockReturnValue('/admin/settings');
    const routeListener = element['routeListener'];
    if (routeListener) {
      routeListener(new CustomEvent('navigate', { detail: { path: '/admin/settings', params: {} } }));
    }
    expect(profileLink?.getAttribute('data-active')).toBe('false');
  });

  it('has data attributes and aria-current for accessibility', () => {
    expect(element.hasAttribute('data-desktop')).toBe(true);
    expect(element.hasAttribute('data-mobile')).toBe(true);
    
    const profileLink = element.querySelector('[data-menu-item="profile"]');
    expect(profileLink?.getAttribute('aria-current')).toBe('page');
    
    vi.spyOn(router, 'getCurrentPath').mockReturnValue('/admin/settings');
    const routeListener = element['routeListener'];
    if (routeListener) {
      routeListener(new CustomEvent('navigate', { detail: { path: '/admin/settings', params: {} } }));
    }
    expect(profileLink?.getAttribute('aria-current')).toBe('false');
  });

  it('handles errors gracefully using ErrorHandler.wrap()', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    delete (window as any).router;
    
    const elementNoRouter = document.createElement('admin-sidebar') as AdminSidebar;
    document.body.appendChild(elementNoRouter);
    
    const profileLink = elementNoRouter.querySelector('[data-menu-item="profile"]') as HTMLElement;
    profileLink?.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    
    expect(errorSpy).toHaveBeenCalled();
    elementNoRouter.remove();
    errorSpy.mockRestore();
  });
});