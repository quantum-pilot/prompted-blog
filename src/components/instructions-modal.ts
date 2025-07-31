export class InstructionsModal extends HTMLElement {
  private modalContainer!: HTMLElement;
  private isVisible: boolean = false;
  private hasChanges: boolean = false;

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
  }

  private render() {
    this.innerHTML = `
      <div class="instructions-container" style="position: fixed !important; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50vw; height: 50vh; background: white; border: 2px solid #d1d5da; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 1000; flex: none !important; display: none;">
        <div class="diff-header" style="background: #f6f8fa; border-bottom: 1px solid #d1d5da; padding: 0.5rem 1rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <span>Instructions</span>
          <button class="close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #656d76; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div id="instructions-content" style="white-space: pre-wrap; padding: 1rem; background: #f6f8fa; border-top: 1px solid #d1d5da; font-family: monospace; font-size: 0.9rem; overflow-y: auto; flex: 1;"></div>
      </div>
    `;
    
    this.modalContainer = this.querySelector('.instructions-container') as HTMLElement;
    
    // Attach close button event
    const closeBtn = this.querySelector('.close-btn') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hide());
  }

  private checkHistoryMode() {
    const url = new URL(window.location.href);
    const isHistory = url.searchParams.get('history_enabled') === 'true';
    
    this.setVisible(isHistory);
  }

  // Show/hide based on history mode
  setVisible(visible: boolean) {
    this.style.display = visible ? 'block' : 'none';
  }

  // Show the modal
  show() {
    if (this.modalContainer) {
      this.modalContainer.style.display = 'flex';
      this.isVisible = true;
    }
  }

  // Hide the modal
  hide() {
    if (this.modalContainer) {
      this.modalContainer.style.display = 'none';
      this.isVisible = false;
    }
  }

  // Load instructions content for specific revision
  async loadInstructions(revisionIndex: number = 0) {
    try {
      const txtPath = `./diff_cache/instructions.txt/${revisionIndex}.txt`;
      const response = await fetch(txtPath);
      
      if (response.ok) {
        const content = await response.text();
        const contentContainer = this.querySelector('#instructions-content') as HTMLElement;
        if (contentContainer) {
          contentContainer.textContent = content;
        }
      } else {
        // If specific revision doesn't exist, try to load latest instructions
        const fallbackResponse = await fetch('instructions.txt');
        if (fallbackResponse.ok) {
          const content = await fallbackResponse.text();
          const contentContainer = this.querySelector('#instructions-content') as HTMLElement;
          if (contentContainer) {
            contentContainer.textContent = content;
          }
        }
      }
    } catch (error) {
      console.error('Failed to load instructions:', error);
      const contentContainer = this.querySelector('#instructions-content') as HTMLElement;
      if (contentContainer) {
        contentContainer.textContent = 'Failed to load instructions.';
      }
    }
  }

  // Set whether instructions have changes (affects button styling)
  setHasChanges(hasChanges: boolean) {
    this.hasChanges = hasChanges;
  }

  // Get current visibility state
  getIsVisible(): boolean {
    return this.isVisible;
  }

  // Get whether instructions have changes
  getHasChanges(): boolean {
    return this.hasChanges;
  }
}

customElements.define('instructions-modal', InstructionsModal);