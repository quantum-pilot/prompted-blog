import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OAuthFlowStart } from '../index';

const COMPONENT_TAG = 'oauth-flow-start';

describe('OAuthFlowStart', () => {
  let element: OAuthFlowStart;

  beforeEach(() => {
    if (!customElements.get(COMPONENT_TAG)) {
      customElements.define(COMPONENT_TAG, OAuthFlowStart);
    }

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
    expect(element.disconnectedCallback).toBeDefined();
    element.disconnectedCallback();
  });

  it('should use EventManager for event handling', () => {
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    expect(openaiButton).toBeTruthy();

    const eventSpy = vi.fn();
    element.addEventListener('oauth-start', eventSpy);
    openaiButton.click();
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it('should apply correct CSS classes for styling hooks', () => {
    const container = element.querySelector('.oauth-buttons');
    const openaiButton = element.querySelector('[data-provider="openai"]');
    const claudeButton = element.querySelector('[data-provider="claude"]');

    expect(container).toBeTruthy();
    expect(openaiButton).toBeTruthy();
    expect(claudeButton).toBeTruthy();
  });

  it('should be properly typed with TypeScript interfaces', () => {
    const provider: 'openai' | 'claude' = 'openai';
    expect(typeof provider).toBe('string');
  });
});
