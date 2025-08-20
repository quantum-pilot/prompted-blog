import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Router, RouteParams, NavigationEvent } from '../router';
import { matchRoute } from '../route-matcher';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    // Clear any existing event listeners
    window.removeEventListener('popstate', vi.fn());
    // Reset location to a known state
    window.history.replaceState({}, '', '/');
    router = new Router();
  });

  afterEach(() => {
    router.destroy();
    vi.clearAllMocks();
  });

  describe('path matching', () => {
    it('should match exact paths', () => {
      const result = matchRoute('/admin', '/admin');
      expect(result).toEqual({ matched: true, params: {} });
    });

    it('should not match different paths', () => {
      const result = matchRoute('/admin', '/users');
      expect(result).toEqual({ matched: false, params: {} });
    });

    it('should match paths with single parameter', () => {
      const result = matchRoute('/admin/users/:id', '/admin/users/123');
      expect(result).toEqual({ 
        matched: true, 
        params: { id: '123' } 
      });
    });

    it('should match paths with multiple parameters', () => {
      const result = matchRoute(
        '/admin/users/:userId/posts/:postId',
        '/admin/users/456/posts/789'
      );
      expect(result).toEqual({ 
        matched: true, 
        params: { userId: '456', postId: '789' } 
      });
    });

    it('should handle trailing slashes', () => {
      const result = matchRoute('/admin/', '/admin');
      expect(result).toEqual({ matched: true, params: {} });
    });

    it('should not match partial paths', () => {
      const result = matchRoute('/admin', '/admin/users');
      expect(result).toEqual({ matched: false, params: {} });
    });

    it('should match wildcard paths', () => {
      const result = matchRoute('/admin/*', '/admin/anything/goes/here');
      expect(result).toEqual({ 
        matched: true, 
        params: { wildcard: 'anything/goes/here' } 
      });
    });
  });

  describe('navigation', () => {
    it('should navigate to a path and emit event', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);

      router.navigate('/admin/users');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            path: '/admin/users',
            params: {}
          }
        })
      );
      expect(window.location.pathname).toBe('/admin/users');
    });

    it('should navigate with query parameters', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);

      router.navigate('/admin/users?sort=name&order=asc');

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            path: '/admin/users',
            params: {},
            query: 'sort=name&order=asc'
          }
        })
      );
    });

    it('should handle browser back/forward navigation', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);
      
      // Navigate to create history entries
      router.navigate('/admin/users');
      router.navigate('/admin/dashboard');
      
      // Clear listener to test only popstate
      listener.mockClear();

      // Simulate browser back button
      window.history.back();
      
      // Trigger the popstate event manually (since jsdom doesn't auto-trigger)
      const popstateEvent = new PopStateEvent('popstate', {
        state: { path: '/admin/users' }
      });
      window.dispatchEvent(popstateEvent);

      expect(listener).toHaveBeenCalled();
      const call = listener.mock.calls[0][0];
      expect(call.detail).toEqual({
        path: '/admin/users',
        params: {}
      });
    });

    it('should not navigate to same path by default', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);

      router.navigate('/admin/users');
      listener.mockClear();
      
      router.navigate('/admin/users');
      expect(listener).not.toHaveBeenCalled();
    });

    it('should force navigate to same path when force option is true', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);

      router.navigate('/admin/users');
      listener.mockClear();
      
      router.navigate('/admin/users', { force: true });
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('route registration', () => {
    it('should register and match routes', () => {
      const handler = vi.fn();
      router.addRoute('/admin/users/:id', handler);

      router.navigate('/admin/users/123');

      expect(handler).toHaveBeenCalledWith({
        path: '/admin/users/123',
        params: { id: '123' }
      });
    });

    it('should handle multiple route handlers', () => {
      const userHandler = vi.fn();
      const postHandler = vi.fn();

      router.addRoute('/admin/users/:id', userHandler);
      router.addRoute('/admin/posts/:id', postHandler);

      router.navigate('/admin/users/123');
      expect(userHandler).toHaveBeenCalled();
      expect(postHandler).not.toHaveBeenCalled();

      userHandler.mockClear();
      postHandler.mockClear();

      router.navigate('/admin/posts/456');
      expect(postHandler).toHaveBeenCalled();
      expect(userHandler).not.toHaveBeenCalled();
    });

    it('should remove route handlers', () => {
      const handler = vi.fn();
      const unsubscribe = router.addRoute('/admin/users/:id', handler);

      router.navigate('/admin/users/123');
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();
      handler.mockClear();

      router.navigate('/admin/users/456', { force: true });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentPath', () => {
    it('should return current pathname', () => {
      router.navigate('/admin/settings');
      expect(router.getCurrentPath()).toBe('/admin/settings');
    });

    it('should not include query parameters', () => {
      router.navigate('/admin/settings?tab=security');
      expect(router.getCurrentPath()).toBe('/admin/settings');
    });
  });

  describe('getQueryParams', () => {
    it('should parse query parameters', () => {
      router.navigate('/admin/users?page=2&sort=name');
      
      const params = router.getQueryParams();
      expect(params).toEqual({
        page: '2',
        sort: 'name'
      });
    });

    it('should handle empty query string', () => {
      router.navigate('/admin/users');
      
      const params = router.getQueryParams();
      expect(params).toEqual({});
    });

    it('should handle array values', () => {
      router.navigate('/admin/users?tags=javascript&tags=typescript');
      
      const params = router.getQueryParams();
      expect(params).toEqual({
        tags: ['javascript', 'typescript']
      });
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', () => {
      const listener = vi.fn();
      router.addEventListener('navigate', listener);

      router.navigate('/admin/test');
      expect(listener).toHaveBeenCalledTimes(1);

      router.removeEventListener('navigate', listener);
      router.navigate('/admin/test2');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      router.addEventListener('navigate', listener1);
      router.addEventListener('navigate', listener2);

      router.navigate('/admin/test');

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should clean up all listeners and handlers', () => {
      const navListener = vi.fn();
      const routeHandler = vi.fn();

      router.addEventListener('navigate', navListener);
      router.addRoute('/admin/test', routeHandler);

      router.destroy();

      // Try to navigate after destroy
      router.navigate('/admin/test');

      expect(navListener).not.toHaveBeenCalled();
      expect(routeHandler).not.toHaveBeenCalled();
    });

    it('should remove popstate listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const newRouter = new Router();
      expect(addEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));

      newRouter.destroy();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('popstate', expect.any(Function));

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });
});