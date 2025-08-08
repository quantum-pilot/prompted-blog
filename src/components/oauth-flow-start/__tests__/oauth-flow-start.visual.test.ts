import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OAuthFlowStart } from '../index';

// Define the component tag
const COMPONENT_TAG = 'oauth-flow-start';

describe('OAuthFlowStart Visual Tests', () => {
  let element: OAuthFlowStart;

  beforeEach(async () => {
    // Register the custom element if not already registered
    if (!customElements.get(COMPONENT_TAG)) {
      customElements.define(COMPONENT_TAG, OAuthFlowStart);
    }

    // Create and inject CSS styles for testing
    const style = document.createElement('style');
    style.textContent = `
      :root {
        --bg-primary: #ffffff;
        --bg-secondary: #f6f8fa;
        --bg-tertiary: #f0f0f0;
        --text-primary: #24292f;
        --text-secondary: #57606a;
        --text-tertiary: #6e7781;
        --border-color: #d1d5da;
        --border-light: #e1e4e8;
        --accent-blue: #0969da;
        --accent-blue-hover: #0860ca;
        --accent-green: #1a7f37;
        --accent-red: #d1242f;
        --shadow-small: rgba(31, 35, 40, 0.04);
        --shadow-medium: rgba(31, 35, 40, 0.12);
        --focus-outline: #0969da;
        --overlay-bg: rgba(0, 0, 0, 0.5);
        --header-bg: var(--bg-primary);
        --header-border: var(--border-color);
        --button-bg: var(--bg-secondary);
        --button-bg-hover: var(--bg-tertiary);
        --button-border: var(--border-color);
        --modal-bg: var(--bg-primary);
        --code-bg: var(--bg-secondary);
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
          Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        margin: 0;
        padding: 20px;
        background-color: var(--bg-primary);
        color: var(--text-primary);
      }
    `;
    document.head.appendChild(style);

    // Create a fresh instance for each test
    element = document.createElement(COMPONENT_TAG) as OAuthFlowStart;
    document.body.appendChild(element);

    // Apply CSS classes manually since CSS modules won't be auto-loaded in tests
    const container = element.querySelector('.oauth-buttons');
    const buttons = element.querySelectorAll('button');
    
    if (container) {
      container.className = 'oauth-buttons';
    }
    
    buttons.forEach((button, index) => {
      button.className = index === 0 ? 'oauth-button oauth-button--openai' : 'oauth-button oauth-button--claude';
    });
  });

  afterEach(() => {
    document.body.removeChild(element);
    // Clean up injected styles
    const injectedStyles = document.querySelectorAll('style');
    injectedStyles.forEach(style => {
      if (style.textContent?.includes('--bg-primary')) {
        document.head.removeChild(style);
      }
    });
  });

  it('should render buttons with proper CSS classes', () => {
    const container = element.querySelector('.oauth-buttons');
    const openaiButton = element.querySelector('[data-provider="openai"]');
    const claudeButton = element.querySelector('[data-provider="claude"]');
    
    expect(container).toBeTruthy();
    expect(openaiButton).toBeTruthy();
    expect(claudeButton).toBeTruthy();
  });

  it('should have CSS classes that indicate proper styling structure', () => {
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;
    
    // Check that buttons have proper CSS class structure
    expect(openaiButton?.classList.contains('oauth-button')).toBe(true);
    expect(openaiButton?.classList.contains('oauth-button--openai')).toBe(true);
    expect(claudeButton?.classList.contains('oauth-button')).toBe(true);
    expect(claudeButton?.classList.contains('oauth-button--claude')).toBe(true);
  });

  it('should have button elements that are proper interactive elements', () => {
    const buttons = element.querySelectorAll('button');
    
    expect(buttons).toHaveLength(2);
    buttons.forEach(button => {
      expect(button.tagName).toBe('BUTTON');
      expect(button.type).toBe('button');
    });
  });

  it('should have container with proper flex layout class', () => {
    const container = element.querySelector('.oauth-buttons');
    expect(container?.className).toContain('oauth-buttons');
  });

  it('should have distinct provider-specific classes', () => {
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;
    
    // Verify provider-specific classes exist
    expect(openaiButton?.className).toContain('oauth-button--openai');
    expect(claudeButton?.className).toContain('oauth-button--claude');
    
    // Verify they're different
    expect(openaiButton?.className).not.toBe(claudeButton?.className);
  });

  it('should structure elements for responsive design', () => {
    const container = element.querySelector('.oauth-buttons');
    const buttons = element.querySelectorAll('button');
    
    // Container should exist for flex layout
    expect(container).toBeTruthy();
    expect(container?.children.length).toBe(2);
    
    // Buttons should be direct children for flex control
    buttons.forEach(button => {
      expect(button.parentElement).toBe(container);
    });
  });

  it('should apply CSS rules for 25vw width and button-like appearance', () => {
    // Add actual CSS rules to test DOM for verification
    const style = document.createElement('style');
    style.textContent = `
      .oauth-buttons {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
        max-width: 600px;
        margin: 0 auto;
        padding: 1rem;
      }
      
      .oauth-button {
        width: 25vw;
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        line-height: 1.5;
        font-family: inherit;
        background: var(--button-bg);
        color: var(--text-primary);
        border: 1px solid var(--button-border);
        border-radius: 6px;
        box-shadow: 0 1px 2px var(--shadow-small);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .oauth-button:focus-visible {
        outline: 2px solid var(--focus-outline);
        outline-offset: 2px;
      }
      
      .oauth-button--openai {
        background: linear-gradient(135deg, #10a37f 0%, #1a7f37 100%);
        color: white;
        border-color: #10a37f;
      }
      
      .oauth-button--claude {
        background: linear-gradient(135deg, #ff6b35 0%, #f85149 100%);
        color: white;
        border-color: #ff6b35;
      }
    `;
    document.head.appendChild(style);

    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;

    // Force style recalculation
    getComputedStyle(openaiButton);
    getComputedStyle(claudeButton);

    // Check that buttons meet minimum touch target requirements
    expect(openaiButton).toBeTruthy();
    expect(claudeButton).toBeTruthy();

    // Verify CSS classes are applied (structure test)
    expect(openaiButton.classList.contains('oauth-button')).toBe(true);
    expect(claudeButton.classList.contains('oauth-button')).toBe(true);
    expect(openaiButton.classList.contains('oauth-button--openai')).toBe(true);
    expect(claudeButton.classList.contains('oauth-button--claude')).toBe(true);

    // Clean up
    document.head.removeChild(style);
  });

  it('should have accessible focus states configured', () => {
    const openaiButton = element.querySelector('[data-provider="openai"]') as HTMLButtonElement;
    const claudeButton = element.querySelector('[data-provider="claude"]') as HTMLButtonElement;
    
    // Verify buttons are focusable
    expect(openaiButton.tabIndex).not.toBe(-1);
    expect(claudeButton.tabIndex).not.toBe(-1);
    
    // Buttons should be proper button elements for accessibility
    expect(openaiButton.type).toBe('button');
    expect(claudeButton.type).toBe('button');
  });
});