export interface EventListenerRecord {
  element: Element | Window | Document;
  event: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
}

/**
 * Centralized event management utility for preventing memory leaks
 * in web components by tracking and cleaning up event listeners
 */
export class EventManager {
  private listeners: EventListenerRecord[] = [];

  /**
   * Add an event listener and track it for cleanup
   */
  addEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
  }

  /**
   * Remove a specific event listener
   */
  removeEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.removeEventListener(event, handler, options);
    
    // Remove from tracking
    this.listeners = this.listeners.filter(
      listener => !(
        listener.element === element &&
        listener.event === event &&
        listener.handler === handler
      )
    );
  }

  /**
   * Clean up all tracked event listeners
   */
  cleanup(): void {
    this.listeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.listeners = [];
  }

  /**
   * Get count of tracked listeners (for debugging)
   */
  getListenerCount(): number {
    return this.listeners.length;
  }

  /**
   * Get details of tracked listeners (for debugging)
   */
  getListenerDetails(): EventListenerRecord[] {
    return [...this.listeners];
  }
}