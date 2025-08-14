/**
 * OAuth Popup Handler
 * Manages popup window lifecycle for OAuth authentication
 */

export interface PopupCallbackData {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

export class OAuthPopupHandler {
  private popup: Window | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private checkInterval: number | null = null;
  private blocked = false;

  /**
   * Open OAuth popup window
   */
  openPopup(url: string): void {
    // Calculate center position
    const width = 500;
    const height = 600;
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);

    // Open popup with specific features
    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
      'scrollbars=yes',
      'resizable=yes'
    ].join(',');

    this.popup = window.open(url, 'oauth-popup', features);

    if (!this.popup) {
      this.blocked = true;
      throw new Error('Popup blocked - please allow popups for authentication');
    }

    // Focus the popup
    this.popup.focus();
  }

  /**
   * Wait for callback message from popup
   */
  waitForCallback(allowedOrigin: string): Promise<PopupCallbackData> {
    return new Promise((resolve, reject) => {
      // Set up message listener
      this.messageHandler = (event: MessageEvent) => {
        // Validate origin for security
        if (event.origin !== allowedOrigin) {
          return;
        }

        // Check if this is our OAuth callback
        if (event.data && (event.data.code || event.data.error)) {
          // Clean up
          this.cleanup();

          // Handle error response
          if (event.data.error) {
            reject(new Error(
              `OAuth error: ${event.data.error} - ${event.data.error_description || 'Unknown error'}`
            ));
            return;
          }

          // Resolve with callback data
          resolve(event.data);
        }
      };

      window.addEventListener('message', this.messageHandler);

      // Check if popup is closed periodically
      this.checkInterval = window.setInterval(() => {
        if (this.popup && this.popup.closed) {
          this.cleanup();
          reject(new Error('Popup closed without completing authentication'));
        }
      }, 500);
    });
  }

  /**
   * Clean up popup and event listeners
   */
  cleanup(): void {
    // Remove message listener
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }

    // Clear interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Close popup if still open
    if (this.popup && !this.popup.closed) {
      this.popup.close();
    }
    this.popup = null;
  }

  /**
   * Check if popup was blocked
   */
  isPopupBlocked(): boolean {
    return this.blocked;
  }

  /**
   * Get popup window reference
   */
  getPopup(): Window | null {
    return this.popup;
  }
}