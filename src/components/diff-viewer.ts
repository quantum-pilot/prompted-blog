import { ApiService } from '../services/api-service.js';
import { DiffRenderer } from '../services/diff-renderer.js';
import { UrlService } from '../services/url-service.js';

declare global {
  const Diff2Html: any;
}

export class DiffViewer extends HTMLElement {
  private apiService: ApiService;
  private urlService: UrlService;
  private diffContainer!: HTMLElement;
  private currentRevisions: { date: string; files: Map<string, any> }[] = [];
  private basePath: string = '';

  constructor() {
    super();
    this.apiService = ApiService.getInstance();
    this.urlService = UrlService.getInstance();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
  }

  private render() {
    this.innerHTML = `
      <div id="diff-output"></div>
    `;
    
    this.diffContainer = this.querySelector('#diff-output') as HTMLElement;
  }

  private checkHistoryMode() {
    this.setVisible(this.urlService.isHistoryEnabled());
  }

  setVisible(visible: boolean) {
    this.style.display = visible ? 'block' : 'none';
  }

  // Initialize with revision data and base path
  async initialize(revisions: { date: string; files: Map<string, any> }[], basePath: string) {
    this.currentRevisions = revisions;
    this.basePath = basePath;
  }

  // Render specific revision
  async renderRevision(revisionIndex: number) {
    if (!this.diffContainer || revisionIndex < 0 || revisionIndex >= this.currentRevisions.length) {
      return;
    }

    // Clear existing content
    this.diffContainer.innerHTML = '';

    const revision = this.currentRevisions[revisionIndex];
    const targets = [
      { name: 'prompts.txt', dir: this.basePath, displayName: 'Prompts' },
      { name: 'output.md', dir: this.basePath, displayName: 'Output' }
    ];

    // Create containers for each file
    const containers = new Map<string, HTMLElement>();

    for (const { name, displayName } of targets) {
      const container = document.createElement('div');
      container.className = 'diff-container';
      container.style.cssText = `
        flex: 1;
        max-height: 75vh;
        min-width: 0;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      `;
      
      containers.set(name, container);
      this.diffContainer.appendChild(container);
    }

    // Process each target file
    for (const { name, dir, displayName } of targets) {
      const container = containers.get(name);
      if (!container) continue;

      const fileInRev = revision.files.get(name);
      
      if (fileInRev) {
        // File changed in this revision
        if (fileInRev.revIdx === 0) {
          // First revision - show as all additions
          const content = await this.apiService.getFileContent(name, dir, fileInRev.revIdx);
          const diffContent = DiffRenderer.buildFirstRevision(displayName, content.split('\n'));
          DiffRenderer.renderDiffInContainer(container, diffContent, false, 'line-by-line');
        } else {
          // Regular revision - show diff with context
          const [diff, content] = await Promise.all([
            this.apiService.getDiff(name, dir, fileInRev.revIdx),
            this.apiService.getFileContent(name, dir, fileInRev.revIdx)
          ]);
          
          const full = content.split('\n');
          const unchanged = !diff;
          const diffContent = unchanged ? 
            DiffRenderer.buildUnchanged(displayName, full) : 
            DiffRenderer.expandDiff(diff!, full, displayName);
          
          DiffRenderer.renderDiffInContainer(container, diffContent, unchanged, 'line-by-line');
        }
      } else {
        // Find most recent version of this file before current revision
        let mostRecentContent = '';
        for (let i = revisionIndex - 1; i >= 0; i--) {
          if (this.currentRevisions[i].files.has(name)) {
            const prevRevIdx = this.currentRevisions[i].files.get(name).revIdx;
            mostRecentContent = await this.apiService.getFileContent(name, dir, prevRevIdx);
            break;
          }
        }
        
        const lines = mostRecentContent ? mostRecentContent.split('\n') : [];
        const diffContent = DiffRenderer.buildUnchanged(displayName, lines);
        DiffRenderer.renderDiffInContainer(container, diffContent, true, 'line-by-line');
      }
    }

    // Add instructions button to prompts container
    const promptsContainer = containers.get('prompts.txt');
    if (promptsContainer) {
      this.addInstructionsButton(promptsContainer, revision);
    }
  }


  private addInstructionsButton(container: HTMLElement, revision: { date: string; files: Map<string, any> }) {
    const instructionsHasChanges = revision.files.has('instructions.txt');
    
    const button = document.createElement('button');
    button.className = `instructions-btn ${instructionsHasChanges ? 'has-changes' : ''}`;
    button.textContent = instructionsHasChanges ? 'Instructions (Updated)' : 'Instructions';
    button.style.cssText = `
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      z-index: 10;
      background: ${instructionsHasChanges ? '#fff3cd' : '#f6f8fa'};
      color: ${instructionsHasChanges ? '#856404' : '#24292f'};
      border: 1px solid ${instructionsHasChanges ? '#ffeaa7' : '#d1d5da'};
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      cursor: pointer;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
    `;

    button.addEventListener('click', () => {
      const modal = document.querySelector('instructions-modal') as any;
      if (modal && modal.show) {
        modal.show();
      }
    });

    const fileHeader = container.querySelector('.d2h-file-header');
    if (fileHeader) {
      fileHeader.appendChild(button);
    }
  }


}

customElements.define('diff-viewer', DiffViewer);