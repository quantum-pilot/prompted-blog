import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminLayout } from '../index';

describe('AdminLayout', () => {
  let element: AdminLayout;

  beforeEach(() => {
    if (!customElements.get('admin-layout')) {
      customElements.define('admin-layout', AdminLayout);
    }
    element = document.createElement('admin-layout') as AdminLayout;
    document.body.appendChild(element);
  });

  afterEach(() => {
    element?.remove();
    vi.clearAllMocks();
  });

  it('extends BaseComponent and uses EventManager', () => {
    expect(element).toBeInstanceOf(HTMLElement);
    const cleanupSpy = vi.spyOn(element['eventManager'], 'cleanup');
    element.disconnectedCallback();
    expect(cleanupSpy).toHaveBeenCalled();
  });

  it('has a toggle button for mobile menu', () => {
    const toggleButton = element.querySelector('button[data-menu-toggle]');
    expect(toggleButton).toBeTruthy();
    expect(toggleButton?.getAttribute('aria-label')).toBe('Toggle menu');
  });

  it('contains two slots: sidebar slot and content slot', () => {
    const sidebarSlot = element.querySelector('slot[name="sidebar"]');
    const contentSlot = element.querySelector('slot[name="content"]');
    expect(sidebarSlot).toBeTruthy();
    expect(contentSlot).toBeTruthy();
  });

  it('dispatches menu-toggle event when toggle button is clicked', () => {
    const spy = vi.fn();
    element.addEventListener('menu-toggle', spy);
    
    const toggleButton = element.querySelector('button[data-menu-toggle]') as HTMLButtonElement;
    toggleButton?.click();
    
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'menu-toggle',
      detail: expect.objectContaining({
        isOpen: true
      })
    }));
  });

  it('tracks menu open/closed state with data-menu-open attribute', () => {
    const toggleButton = element.querySelector('button[data-menu-toggle]') as HTMLButtonElement;
    
    // Initially closed
    expect(element.getAttribute('data-menu-open')).toBe('false');
    
    // Click to open
    toggleButton?.click();
    expect(element.getAttribute('data-menu-open')).toBe('true');
    
    // Click to close
    toggleButton?.click();
    expect(element.getAttribute('data-menu-open')).toBe('false');
  });

  it('includes data attributes for responsive styling hooks', () => {
    expect(element.hasAttribute('data-responsive')).toBe(true);
    expect(element.getAttribute('data-responsive')).toBe('true');
  });

  it('toggle button is visible only on mobile/portrait (has correct data attribute)', () => {
    const toggleButton = element.querySelector('button[data-menu-toggle]') as HTMLButtonElement;
    expect(toggleButton?.hasAttribute('data-mobile-only')).toBe(true);
  });

  it('has correct structure with wrapper elements', () => {
    const wrapper = element.querySelector('[data-layout-wrapper]');
    const sidebar = element.querySelector('[data-sidebar-wrapper]');
    const content = element.querySelector('[data-content-wrapper]');
    
    expect(wrapper).toBeTruthy();
    expect(sidebar).toBeTruthy();
    expect(content).toBeTruthy();
  });

  it('toggle button has proper accessibility attributes', () => {
    const toggleButton = element.querySelector('button[data-menu-toggle]') as HTMLButtonElement;
    expect(toggleButton?.getAttribute('aria-label')).toBe('Toggle menu');
    expect(toggleButton?.getAttribute('type')).toBe('button');
  });
});