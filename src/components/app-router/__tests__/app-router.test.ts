import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AppRouter } from '../index';
import { Router } from '../../../utils/router';

vi.mock('../../../utils/router', () => ({
  Router: vi.fn(() => ({
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    getCurrentPath: vi.fn(),
    navigate: vi.fn(),
    destroy: vi.fn()
  }))
}));

describe('AppRouter', () => {
  let element: AppRouter;
  let mockRouter: any;

  beforeEach(() => {
    if (!customElements.get('app-router')) {
      customElements.define('app-router', AppRouter);
    }
    mockRouter = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getCurrentPath: vi.fn().mockReturnValue('/'),
      navigate: vi.fn(),
      destroy: vi.fn()
    };
    (Router as any).mockImplementation(() => mockRouter);
    element = document.createElement('app-router') as AppRouter;
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

  it('has slot for route-specific content', () => {
    expect(element.querySelector('slot')).toBeTruthy();
  });

  it('listens to router navigation events', () => {
    expect(mockRouter.addEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
  });

  it('dispatches custom event when route changes', () => {
    const spy = vi.fn();
    element.addEventListener('route-change', spy);
    const handler = mockRouter.addEventListener.mock.calls[0][1];
    handler(new CustomEvent('navigate', { detail: { path: '/test', params: { id: '123' }, query: 'foo=bar' }}));
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'route-change',
      detail: { path: '/test', params: { id: '123' }, query: 'foo=bar' }
    }));
  });

  it('sets and updates data-route attribute', () => {
    expect(element.getAttribute('data-route')).toBe('/');
    const handler = mockRouter.addEventListener.mock.calls[0][1];
    handler(new CustomEvent('navigate', { detail: { path: '/about', params: {} }}));
    expect(element.getAttribute('data-route')).toBe('/about');
  });

  it('handles route not found scenarios gracefully', () => {
    const spy = vi.fn();
    element.addEventListener('route-not-found', spy);
    element.handleRouteNotFound('/unknown');
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'route-not-found',
      detail: { path: '/unknown' }
    }));
  });

  it('wraps async operations with ErrorHandler', () => {
    const errorRouter = {
      addEventListener: vi.fn().mockImplementation(() => { throw new Error('Router error'); }),
      removeEventListener: vi.fn(),
      getCurrentPath: vi.fn().mockReturnValue('/'),
      navigate: vi.fn(),
      destroy: vi.fn()
    };
    (Router as any).mockImplementation(() => errorRouter);
    const errorElement = document.createElement('app-router') as AppRouter;
    expect(() => document.body.appendChild(errorElement)).not.toThrow();
    errorElement.remove();
  });

  it('cleans up router on disconnect', () => {
    element.disconnectedCallback();
    expect(mockRouter.removeEventListener).toHaveBeenCalledWith('navigate', expect.any(Function));
  });
});