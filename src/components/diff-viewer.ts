import { ApiService } from '../services/api-service.js';
import { DiffRenderer } from '../services/diff-renderer.js';

declare global {
  const Diff2Html: any;
}

export class DiffViewer extends HTMLElement {
  private apiService: ApiService;
  private diffContainer!: HTMLElement;
  private currentRevisions: { date: string; files: Map<string, any> }[] = [];
  private basePath: string = '';

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
      <div id="diff-output" style="display: flex; gap: 1rem; justify-content: center; margin-top: 3rem; width: 90vw; margin-inline: auto; box-sizing: border-box;"></div>
    `;
    
    this.diffContainer = this.querySelector('#diff-output') as HTMLElement;
  }

  private checkHistoryMode() {
    const url = new URL(window.location.href);
    const isHistory = url.searchParams.get('history_enabled') === 'true';
    
    this.setVisible(isHistory);
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
            this.expandDiff(diff!, full, displayName);
          
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


  // Expand diff with full file context
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
}

customElements.define('diff-viewer', DiffViewer);