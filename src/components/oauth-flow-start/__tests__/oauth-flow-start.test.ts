import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import { OAuthFlowStart } from "../index";
import { OAuthClient } from "../../../api/oauth-client";
import { ProfileClient } from "../../../api/profile-client";

const TAG = "oauth-flow-start";
vi.mock("../../../api/oauth-client");
vi.mock("../../../api/profile-client");

describe("OAuthFlowStart", () => {
  let element: OAuthFlowStart;
  let mockOAuthClient: { logout: Mock };
  let mockProfileClient: { getProfile: Mock };

  beforeEach(() => {
    mockOAuthClient = { logout: vi.fn().mockResolvedValue(undefined) };
    mockProfileClient = { getProfile: vi.fn().mockResolvedValue({ success: false }) };
    (OAuthClient as any).mockImplementation(() => mockOAuthClient);
    (ProfileClient as any).mockImplementation(() => mockProfileClient);
    if (!customElements.get(TAG)) customElements.define(TAG, OAuthFlowStart);
    element = document.createElement(TAG) as OAuthFlowStart;
  });

  afterEach(() => {
    if (element.parentNode) document.body.removeChild(element);
    vi.clearAllMocks();
  });

  it("should extend BaseComponent", () => {
    document.body.appendChild(element);
    expect(element).toBeInstanceOf(HTMLElement);
  });

  it("should check authentication status on initialization", async () => {
    document.body.appendChild(element);
    await vi.waitFor(() => expect(mockProfileClient.getProfile).toHaveBeenCalled());
  });

  it("should show login button when not authenticated", async () => {
    document.body.appendChild(element);
    await vi.waitFor(() => expect(element.querySelector("button")?.textContent).toContain("Sign in with Google"));
  });

  it("should show logout button when authenticated", async () => {
    mockProfileClient.getProfile.mockResolvedValue({ 
      success: true, user: { id: "123", email: "test@example.com" }
    });
    const authEl = document.createElement(TAG) as OAuthFlowStart;
    document.body.appendChild(authEl);
    await vi.waitFor(() => expect(authEl.querySelector("button")?.textContent).toContain("Sign out"));
    document.body.removeChild(authEl);
  });

  it("should emit oauth-start event on login click", () => {
    document.body.appendChild(element);
    const spy = vi.fn();
    element.addEventListener("oauth-start", spy);
    element.querySelector("button")?.click();
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "oauth-start", detail: { provider: "google" } })
    );
  });

  it("should call logout when logout button clicked", async () => {
    mockProfileClient.getProfile.mockResolvedValue({ success: true, user: { id: "1" } });
    const authEl = document.createElement(TAG) as OAuthFlowStart;
    document.body.appendChild(authEl);
    await vi.waitFor(() => expect(authEl.querySelector("button")?.textContent).toContain("Sign out"));
    authEl.querySelector("button")?.click();
    await vi.waitFor(() => expect(mockOAuthClient.logout).toHaveBeenCalled());
    document.body.removeChild(authEl);
  });

  it("should disable button during logout", async () => {
    mockProfileClient.getProfile.mockResolvedValue({ success: true, user: { id: "1" } });
    mockOAuthClient.logout.mockImplementation(() => new Promise(r => setTimeout(r, 50)));
    const authEl = document.createElement(TAG) as OAuthFlowStart;
    document.body.appendChild(authEl);
    await vi.waitFor(() => expect(authEl.querySelector("button")?.textContent).toContain("Sign out"));
    authEl.querySelector("button")?.click();
    await vi.waitFor(() => expect(authEl.querySelector("button")?.disabled).toBe(true));
    await vi.waitFor(() => expect(authEl.querySelector("button")?.disabled).toBe(false), { timeout: 100 });
    document.body.removeChild(authEl);
  });

  it("should update UI on oauth:logout event", async () => {
    mockProfileClient.getProfile.mockResolvedValue({ success: true, user: { id: "1" } });
    const authEl = document.createElement(TAG) as OAuthFlowStart;
    document.body.appendChild(authEl);
    await vi.waitFor(() => expect(authEl.querySelector("button")?.textContent).toContain("Sign out"));
    window.dispatchEvent(new CustomEvent("oauth:logout"));
    await vi.waitFor(() => expect(authEl.querySelector("button")?.textContent).toContain("Sign in"));
    document.body.removeChild(authEl);
  });

  it("should clean up event listeners on disconnect", () => {
    expect(element.disconnectedCallback).toBeDefined();
    element.disconnectedCallback();
  });
});