import { BaseComponent } from "../../utils/base-component.js";
import { ProfileClient } from "../../api/profile-client.js";
import { checkUsernameValidity } from "@app/shared/contracts/username-validator";
import styles from "./username-setup-modal.module.css";

export class UsernameSetupModal extends BaseComponent {
  private profileClient = new ProfileClient();
  private checkTimer?: number;
  private currentUsername = "";
  private isAvailable = false;

  constructor() {
    super();
    this.classList.add("username-setup-modal");
    this.dataset.component = "username-setup-modal";
    this.render();
    this.setupEventListeners();
  }

  private render(): void {
    this.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-card">
          <h2>Choose Your Username</h2>
          <p class="subtitle">This will be your unique subdomain: <span class="subdomain-preview">[username].promptedblog.com</span></p>
          <form>
            <input type="text" placeholder="Enter username" minlength="3" maxlength="30" pattern="^[a-z0-9-]+$" required>
            <div class="status-indicator"></div>
            <button type="submit" disabled>Set Username</button>
          </form>
        </div>
      </div>`;
  }

  private setupEventListeners(): void {
    const input = this.querySelector("input") as HTMLInputElement;
    const form = this.querySelector("form") as HTMLFormElement;
    this.addManagedEventListener(input, "input", this.handleInput.bind(this));
    this.addManagedEventListener(form, "submit", this.handleSubmit.bind(this));
  }

  private handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value.toLowerCase();
    this.currentUsername = value;
    this.updatePreview(value);
    clearTimeout(this.checkTimer);
    this.setStatus("");
    
    // Check validity locally first
    const validityError = checkUsernameValidity(value);
    if (validityError) {
      // If there's a validation error, show it and don't check with server
      this.setButton(true);
      this.isAvailable = false;
      // Don't show error for partial input
      if (value.length >= 3) {
        this.setStatus("taken");
      }
      return;
    }
    
    // Only check with server if locally valid
    this.setStatus("checking");
    this.checkTimer = window.setTimeout(() => this.checkAvailability(value), 500);
  }

  private async checkAvailability(username: string): Promise<void> {
    try {
      const res = await this.profileClient.checkUsernameAvailability(username);
      if (username !== this.currentUsername) return;
      this.isAvailable = res.success && res.available;
      this.setStatus(this.isAvailable ? "available" : "taken");
      this.setButton(!this.isAvailable);
    } catch {
      this.setStatus("error");
      this.setButton(true);
    }
  }

  private async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.isAvailable) return;
    const button = this.querySelector("button") as HTMLButtonElement;
    button.disabled = true;
    const res = await this.profileClient.updateProfile(this.currentUsername);
    if (res.success) {
      this.dispatchEvent(new CustomEvent("username-setup-complete", {
        detail: { username: this.currentUsername }, bubbles: true
      }));
    } else {
      button.disabled = false;
      this.setStatus("error");
    }
  }

  private updatePreview(value: string): void {
    const preview = this.querySelector(".subdomain-preview") as HTMLElement;
    preview.textContent = value ? `${value}.promptedblog.com` : "[username].promptedblog.com";
  }
  private setStatus(status: string): void {
    const indicator = this.querySelector(".status-indicator") as HTMLElement;
    indicator.className = status ? `status-indicator ${status}` : "status-indicator";
  }
  private setButton(disabled: boolean): void {
    (this.querySelector("button") as HTMLButtonElement).disabled = disabled;
  }

  disconnectedCallback(): void {
    clearTimeout(this.checkTimer);
    super.disconnectedCallback();
  }
}