import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OAuthPopupHandler } from '../api/oauth-popup-handler';

describe('OAuthPopupHandler', () => {
  let originalWindow: Window & typeof globalThis;
  let mockWindow: any;

  beforeEach(() => {
    originalWindow = window;
    
    // Mock window.open
    mockWindow = {
      close: vi.fn(),
      closed: false,
      focus: vi.fn(),
      location: { href: '' }
    };
    
    vi.spyOn(window, 'open').mockReturnValue(mockWindow);
    vi.spyOn(window, 'removeEventListener');
    vi.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('openPopup', () => {
    it('should open popup with correct dimensions and position', () => {
      const handler = new OAuthPopupHandler();
      const url = 'https://auth.example.com/authorize';
      
      handler.openPopup(url);
      
      expect(window.open).toHaveBeenCalledWith(
        url,
        'oauth-popup',
        expect.stringContaining('width=500')
      );
      expect(window.open).toHaveBeenCalledWith(
        url,
        'oauth-popup',
        expect.stringContaining('height=600')
      );
    });

    it('should center popup on screen', () => {
      const handler = new OAuthPopupHandler();
      const url = 'https://auth.example.com/authorize';
      
      // Mock screen dimensions
      Object.defineProperty(window, 'screen', {
        value: { width: 1920, height: 1080 },
        writable: true
      });
      
      handler.openPopup(url);
      
      const callArgs = (window.open as any).mock.calls[0][2];
      expect(callArgs).toContain('left=710'); // (1920 - 500) / 2
      expect(callArgs).toContain('top=240'); // (1080 - 600) / 2
    });

    it('should throw error if popup is blocked', () => {
      const handler = new OAuthPopupHandler();
      vi.spyOn(window, 'open').mockReturnValue(null);
      
      expect(() => handler.openPopup('https://auth.example.com'))
        .toThrow('Popup blocked');
    });

    it('should store popup reference', () => {
      const handler = new OAuthPopupHandler();
      const url = 'https://auth.example.com/authorize';
      
      handler.openPopup(url);
      
      expect(handler.getPopup()).toBe(mockWindow);
    });
  });

  describe('waitForCallback', () => {
    it('should resolve with message data when valid origin', async () => {
      const handler = new OAuthPopupHandler();
      const allowedOrigin = 'https://app.example.com';
      
      handler.openPopup('https://auth.example.com');
      
      const promise = handler.waitForCallback(allowedOrigin);
      
      // Simulate message event
      const messageEvent = new MessageEvent('message', {
        origin: allowedOrigin,
        data: { code: 'auth-code-123', state: 'state-456' }
      });
      
      // Get the event listener that was added
      const addEventListenerCall = (window.addEventListener as any).mock.calls[0];
      const messageHandler = addEventListenerCall[1];
      
      // Call the handler directly
      messageHandler(messageEvent);
      
      const result = await promise;
      expect(result).toEqual({ code: 'auth-code-123', state: 'state-456' });
    });

    it('should ignore messages from invalid origins', async () => {
      const handler = new OAuthPopupHandler();
      const allowedOrigin = 'https://app.example.com';
      
      handler.openPopup('https://auth.example.com');
      
      const promise = handler.waitForCallback(allowedOrigin);
      
      // Simulate message from wrong origin
      const wrongOriginEvent = new MessageEvent('message', {
        origin: 'https://evil.com',
        data: { code: 'evil-code', state: 'evil-state' }
      });
      
      const addEventListenerCall = (window.addEventListener as any).mock.calls[0];
      const messageHandler = addEventListenerCall[1];
      
      // This should be ignored
      messageHandler(wrongOriginEvent);
      
      // Now send correct origin
      const validEvent = new MessageEvent('message', {
        origin: allowedOrigin,
        data: { code: 'valid-code', state: 'valid-state' }
      });
      
      messageHandler(validEvent);
      
      const result = await promise;
      expect(result).toEqual({ code: 'valid-code', state: 'valid-state' });
    });

    it('should reject if popup is closed without sending message', async () => {
      vi.useFakeTimers();
      
      const handler = new OAuthPopupHandler();
      handler.openPopup('https://auth.example.com');
      
      const promise = handler.waitForCallback('https://app.example.com');
      
      // Simulate popup being closed
      mockWindow.closed = true;
      
      // Trigger the interval check
      vi.runOnlyPendingTimers();
      
      await expect(promise).rejects.toThrow('Popup closed without completing authentication');
      
      vi.useRealTimers();
    });

    it('should handle error messages', async () => {
      const handler = new OAuthPopupHandler();
      const allowedOrigin = 'https://app.example.com';
      
      handler.openPopup('https://auth.example.com');
      
      const promise = handler.waitForCallback(allowedOrigin);
      
      const errorEvent = new MessageEvent('message', {
        origin: allowedOrigin,
        data: { error: 'access_denied', error_description: 'User denied access' }
      });
      
      const addEventListenerCall = (window.addEventListener as any).mock.calls[0];
      const messageHandler = addEventListenerCall[1];
      
      messageHandler(errorEvent);
      
      await expect(promise).rejects.toThrow('OAuth error: access_denied - User denied access');
    });
  });

  describe('cleanup', () => {
    it('should close popup and remove event listeners', () => {
      const handler = new OAuthPopupHandler();
      handler.openPopup('https://auth.example.com');
      
      // Start waiting for callback to set up the message listener
      handler.waitForCallback('https://app.example.com');
      
      handler.cleanup();
      
      expect(mockWindow.close).toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should clear interval timer', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const handler = new OAuthPopupHandler();
      handler.openPopup('https://auth.example.com');
      handler.waitForCallback('https://app.example.com');
      
      handler.cleanup();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      
      vi.useRealTimers();
    });

    it('should handle cleanup when popup already closed', () => {
      const handler = new OAuthPopupHandler();
      handler.openPopup('https://auth.example.com');
      mockWindow.closed = true;
      
      expect(() => handler.cleanup()).not.toThrow();
      expect(mockWindow.close).not.toHaveBeenCalled();
    });
  });

  describe('isPopupBlocked', () => {
    it('should detect blocked popup', () => {
      const handler = new OAuthPopupHandler();
      vi.spyOn(window, 'open').mockReturnValue(null);
      
      try {
        handler.openPopup('https://auth.example.com');
      } catch (e) {
        // Expected
      }
      
      expect(handler.isPopupBlocked()).toBe(true);
    });

    it('should return false when popup opens successfully', () => {
      const handler = new OAuthPopupHandler();
      handler.openPopup('https://auth.example.com');
      
      expect(handler.isPopupBlocked()).toBe(false);
    });
  });
});