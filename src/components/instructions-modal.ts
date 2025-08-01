import { DiffRenderer } from '../services/diff-renderer.js';
import { ApiService } from '../services/api-service.js';

export class InstructionsModal extends HTMLElement {
  private modalContainer!: HTMLElement;
  private isVisible: boolean = false;
  private hasChanges: boolean = false;
  private apiService: ApiService;
  private currentRevisions: { date: string; files: Map<string, any> }[] = [];

  constructor() {
    super();
    this.apiService = ApiService.getInstance();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
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

  // Initialize with revision data (same as diff-viewer)
  async initialize(revisions: { date: string; files: Map<string, any> }[]) {
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
  async loadInstructions(revision: { date: string; files: Map<string, any> }, revisionIndex: number) {
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
            this.expandDiff(diff!, full, displayName);

          DiffRenderer.renderDiffInContainer(contentContainer, diffContent, unchanged, 'line-by-line');
        }
      } else {
        // Find most recent version of this file before current revision (same logic as diff-viewer)
        let mostRecentContent = '';
        for (let i = revisionIndex - 1; i >= 0; i--) {
          if (this.currentRevisions[i].files.has(fileName)) {
            const prevRevIdx = this.currentRevisions[i].files.get(fileName).revIdx;
            mostRecentContent = await this.apiService.getFileContent(fileName, dir, prevRevIdx);
            break;
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

  // Expand diff with full file context (same logic as diff-viewer)
  private expandDiff(diffText: string, fullLines: string[], displayName: string): string {
    if (!diffText) return '';

    const src = diffText.split('\n');
    const out = [];
    let i = 0;

    // Process headers
    while (i < src.length && !src[i].startsWith('@@')) {
      let line = src[i++];
      // Replace full paths with display names
      if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
        const prefix = line.substring(0, 6);
        line = prefix + displayName;
      }
      out.push(line);
    }

    // Check if diff starts at line 1
    let startsAtLineOne = false;
    if (i < src.length) {
      const firstHunk = src[i];
      const m = /@@ -(\d+)/.exec(firstHunk);
      startsAtLineOne = m !== null && +m[1] === 1;
    }

    // Add dummy header if diff doesn't start at line 1
    if (!startsAtLineOne) {
      out.push(`@@ -0,0 +0,0 @@`);
      out.push(` `); // dummy line
    }

    let prevNew = 1;
    while (i < src.length) {
      const head = src[i];
      const m = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(head);
      if (!m) {
        out.push(src[i++]);
        continue;
      }

      const newStart = +m[1];
      const newCount = +(m[2] || 1);

      // Add context lines before the hunk
      for (let ln = prevNew; ln < newStart; ln++) {
        out.push(' ' + (fullLines[ln - 1] || ''));
      }

      out.push(head);
      i++;

      // Add hunk content
      while (i < src.length && !src[i].startsWith('@@')) {
        out.push(src[i++]);
      }

      prevNew = newStart + newCount;
    }

    // Add remaining context lines
    for (let ln = prevNew; ln <= fullLines.length; ln++) {
      out.push(' ' + (fullLines[ln - 1] || ''));
    }

    return out.join('\n');
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
