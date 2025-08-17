export interface EventListenerRecord {
  element: Element | Window | Document;
  event: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
}

export class EventManager {
  private listeners: EventListenerRecord[] = [];

  addEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.addEventListener(event, handler, options);
    this.listeners.push({ element, event, handler, options });
  }

  removeEventListener(
    element: Element | Window | Document,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): void {
    element.removeEventListener(event, handler, options);

    this.listeners = this.listeners.filter(
      (listener) =>
        !(
          listener.element === element &&
          listener.event === event &&
          listener.handler === handler
        )
    );
  }

  cleanup(): void {
    this.listeners.forEach(({ element, event, handler, options }) => {
      element.removeEventListener(event, handler, options);
    });
    this.listeners = [];
  }
}
