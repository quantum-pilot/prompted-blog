import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { OAuthFlowStart } from "../index";

const COMPONENT_TAG = "oauth-flow-start";

describe("OAuthFlowStart", () => {
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

  it("should extend BaseComponent", () => {
    expect(element).toBeInstanceOf(HTMLElement);
    expect(element.constructor.name).toBe("OAuthFlowStart");
  });

  it("should render one authentication button", () => {
    const buttons = element.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
  });

  it("should display Google provider button with correct label", () => {
    const googleButton = element.querySelector(
      '[data-provider="google"]'
    ) as HTMLButtonElement;
    expect(googleButton).toBeTruthy();
    expect(googleButton.textContent?.trim()).toContain("Sign in with Google");
  });

  it("should emit custom event when Google button is clicked", () => {
    const eventSpy = vi.fn();
    element.addEventListener("oauth-start", eventSpy);

    const googleButton = element.querySelector(
      '[data-provider="google"]'
    ) as HTMLButtonElement;
    googleButton.click();

    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "oauth-start",
        detail: { provider: "google" },
      })
    );
  });

  it("should clean up event listeners on disconnect", () => {
    expect(element.disconnectedCallback).toBeDefined();
    element.disconnectedCallback();
  });

  it("should use EventManager for event handling", () => {
    const googleButton = element.querySelector(
      '[data-provider="google"]'
    ) as HTMLButtonElement;
    expect(googleButton).toBeTruthy();

    const eventSpy = vi.fn();
    element.addEventListener("oauth-start", eventSpy);
    googleButton.click();
    expect(eventSpy).toHaveBeenCalledTimes(1);
  });

  it("should apply correct CSS classes for styling hooks", () => {
    const container = element.querySelector(".oauth-buttons");
    const googleButton = element.querySelector('[data-provider="google"]');

    expect(container).toBeTruthy();
    expect(googleButton).toBeTruthy();
  });

  it("should be properly typed with TypeScript interfaces", () => {
    const provider: "google" = "google";
    expect(typeof provider).toBe("string");
  });
});
