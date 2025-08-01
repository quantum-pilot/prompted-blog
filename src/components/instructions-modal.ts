import { DiffRenderer } from '../services/diff-renderer.js';
import { ApiService } from '../services/api-service.js';
import { UrlService } from '../services/url-service.js';
import type { RevisionData } from '../types/index.js';

export class InstructionsModal extends HTMLElement {
  private modalContainer!: HTMLElement;
  private isVisible: boolean = false;
  private hasChanges: boolean = false;
  private apiService: ApiService;
  private urlService: UrlService;
  private currentRevisions: RevisionData[] = [];
  private closeButtonListener: { element: Element; handler: EventListener } | null = null;

  constructor() {
    super();
    this.apiService = ApiService.getInstance();
    this.urlService = UrlService.getInstance();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  private cleanup() {
    if (this.closeButtonListener) {
      this.closeButtonListener.element.removeEventListener('click', this.closeButtonListener.handler);
      this.closeButtonListener = null;
    }
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
    closeBtn.addEventListener('click', handler);
    this.closeButtonListener = { element: closeBtn, handler };
  }

  private checkHistoryMode() {
    this.setVisible(this.urlService.isHistoryEnabled());
  }

  // Show/hide based on history mode
  setVisible(visible: boolean) {
    this.style.display = visible ? 'block' : 'none';
  }

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

  // Load instructions content using the same revision logic as diff-viewer
  async loadInstructions(revision: RevisionData, revisionIndex: number) {
    try {
      const contentContainer = this.querySelector('#instructions-content') as HTMLElement;
      if (!contentContainer) return;

      // Clear existing content
      contentContainer.innerHTML = '';

      const fileName = 'instructions.txt';
      const dir = '.';
      const displayName = 'Instructions';

      const fileInRev = revision.files.get(fileName);

      if (fileInRev) {
        // File changed in this revision - follow exact same logic as diff-viewer
        if (fileInRev.revIdx === 0) {
          // First revision - show as all additions
          const content = await this.apiService.getFileContent(fileName, dir, fileInRev.revIdx);
          const diffContent = DiffRenderer.buildFirstRevision(displayName, content.split('\n'));
          DiffRenderer.renderDiffInContainer(contentContainer, diffContent, false, 'line-by-line');
        } else {
          // Regular revision - show diff with context
          const [diff, content] = await Promise.all([
            this.apiService.getDiff(fileName, dir, fileInRev.revIdx),
            this.apiService.getFileContent(fileName, dir, fileInRev.revIdx)
          ]);

          const full = content.split('\n');
          const unchanged = !diff;
          const diffContent = unchanged ?
            DiffRenderer.buildUnchanged(displayName, full) :
            DiffRenderer.expandDiff(diff!, full, displayName);

          DiffRenderer.renderDiffInContainer(contentContainer, diffContent, unchanged, 'line-by-line');
        }
      } else {
        // Find most recent version of this file before current revision (same logic as diff-viewer)
        let mostRecentContent = '';
        for (let i = revisionIndex - 1; i >= 0; i--) {
          if (this.currentRevisions[i].files.has(fileName)) {
            const fileInfo = this.currentRevisions[i].files.get(fileName);
            if (fileInfo) {
              mostRecentContent = await this.apiService.getFileContent(fileName, dir, fileInfo.revIdx);
              break;
            }
          }
        }

        const lines = mostRecentContent ? mostRecentContent.split('\n') : [];
        const diffContent = DiffRenderer.buildUnchanged(displayName, lines);
        DiffRenderer.renderDiffInContainer(contentContainer, diffContent, true, 'line-by-line');
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
