import { DiffRenderer } from '../services/diff-renderer.js';
import { BaseComponent } from '../utils/base-component.js';
import type { RevisionData } from '../types/index.js';

export class InstructionsModal extends BaseComponent {
  private modalContainer!: HTMLElement;
  private isVisible: boolean = false;
  private hasChanges: boolean = false;
  private currentRevisions: RevisionData[] = [];

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
  }

  protected cleanup() {
    // BaseComponent handles event cleanup automatically
  }

  private render() {
    this.innerHTML = `
      <div class="instructions-container" style="position: fixed !important; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50vw; height: 50vh; background: white; border: 2px solid #d1d5da; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 1000; flex: none !important; display: none;">
        <div class="diff-header" style="background: #f6f8fa; border-bottom: 1px solid #d1d5da; padding: 0.5rem 1rem; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
          <button class="close-btn" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #656d76; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div id="instructions-content" style="white-space: initial; padding: 1rem; background: #f6f8fa; border-top: 1px solid #d1d5da; font-family: monospace; font-size: 0.9rem; overflow-x: clip; overflow-y: auto; flex: 1;"></div>
      </div>
    `;

    this.modalContainer = this.querySelector('.instructions-container') as HTMLElement;

    // Attach close button event
    const closeBtn = this.querySelector('.close-btn') as HTMLButtonElement;
    const handler = () => this.hide();
    this.addManagedEventListener(closeBtn, 'click', handler);
  }

  protected checkHistoryMode() {
    this.setVisible(this.urlService.isHistoryEnabled());
  }

  // setVisible method now provided by BaseComponent

  // Initialize with revision data (same as diff-viewer)
  async initialize(revisions: RevisionData[]) {
    this.currentRevisions = revisions;
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

  // Load instructions content using the centralized rendering method
  async loadInstructions(revision: RevisionData, revisionIndex: number) {
    const contentContainer = this.querySelector('#instructions-content') as HTMLElement;
    if (!contentContainer) return;

    // Clear existing content
    contentContainer.innerHTML = '';

    await DiffRenderer.renderFileRevision(
      'instructions.txt',
      '.',
      'Instructions',
      contentContainer,
      revision,
      revisionIndex,
      this.currentRevisions,
      this.apiService
    );
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
