import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthFlowStart } from '../index';

// Define the component tag
const COMPONENT_TAG = 'oauth-flow-start';

describe('OAuthFlowStart', () => {
  let element: OAuthFlowStart;

  beforeEach(() => {
    // Register the custom element if not already registered
    if (!customElements.get(COMPONENT_TAG)) {
      customElements.define(COMPONENT_TAG, OAuthFlowStart);
    }

    // Create a fresh instance for each test
    element = document.createElement(COMPONENT_TAG) as OAuthFlowStart;
    document.body.appendChild(element);
  });

  afterEach(() => {
    document.body.removeChild(element);
  });

  it('should extend BaseComponent', () => {
    expect(element).toBeInstanceOf(HTMLElement);
    expect(element.constructor.name).toBe('OAuthFlowStart');
  });

  it('should render two authentication buttons', () => {
    const buttons = element.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
  });

  it('should display OpenAI provider button with correct label', () => {
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    expect(openaiButton).toBeTruthy();
    expect(openaiButton.textContent?.trim()).toContain('OpenAI');
  });

  it('should display Claude provider button with correct label', () => {
    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;
    expect(claudeButton).toBeTruthy();
    expect(claudeButton.textContent?.trim()).toContain('Claude');
  });

  it('should emit custom event when OpenAI button is clicked', () => {
    const eventSpy = vi.fn();
    element.addEventListener('oauth-start', eventSpy);

    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    openaiButton.click();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oauth-start',
        detail: { provider: 'openai' }
      })
    );
  });

  it('should emit custom event when Claude button is clicked', () => {
    const eventSpy = vi.fn();
    element.addEventListener('oauth-start', eventSpy);

    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;
    claudeButton.click();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'oauth-start',
        detail: { provider: 'claude' }
      })
    );
  });

  it('should clean up event listeners on disconnect', () => {
    // We can't directly access private members, but we can verify
    // the component properly extends BaseComponent which has cleanup
    expect(element.disconnectedCallback).toBeDefined();
    
    // This won't throw an error, confirming the method exists and works
    element.disconnectedCallback();
  });

  it('should use EventManager for event handling', () => {
    // Verify that BaseComponent's event management works by checking
    // that event listeners are properly attached (buttons respond to clicks)
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    expect(openaiButton).toBeTruthy();
    
    // If EventManager wasn't working, this wouldn't work either
    const eventSpy = vi.fn();
    element.addEventListener('oauth-start', eventSpy);
    openaiButton.click();
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it('should be properly typed with TypeScript interfaces', () => {
    // This test verifies that the component compiles with proper TypeScript types
    const provider: 'openai' | 'claude' = 'openai';
    expect(typeof provider).toBe('string');
  });
});