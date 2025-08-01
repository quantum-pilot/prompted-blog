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
  private tabContainer!: HTMLElement;
  private tabContent!: HTMLElement;
  private currentRevisions: { date: string; files: Map<string, any> }[] = [];
  private basePath: string = '';
  private activeTab: 'prompts' | 'output' | 'instructions' = 'prompts';
  private currentRevisionIndex: number = 0;

  constructor() {
    super();
    this.apiService = ApiService.getInstance();
    this.urlService = UrlService.getInstance();
  }

  connectedCallback() {
    console.log('🎯 DIFF-VIEWER V2025.01.01 LOADING!');
    // Force update if this element has old content
    if (!this.querySelector('.diff-viewer-container')) {
      console.log('🔄 Detected old structure, forcing update...');
      this.innerHTML = ''; // Clear old content
    }
    this.render();
    this.checkHistoryMode();
  }

  private render() {
    this.innerHTML = `
      <div class="diff-viewer-container">
        <!-- Mobile Tab Navigation -->
        <div class="tab-navigation">
          <button class="tab-button active" data-tab="prompts">
            <span class="tab-title">
              <span class="tab-main">
                <span class="tab-icon">📝</span>
                Prompts
              </span>
            </span>
          </button>
          <button class="tab-button" data-tab="output">
            <span class="tab-title">
              <span class="tab-main">
                <span class="tab-icon">📄</span>
                Output
              </span>
            </span>
          </button>
          <button class="tab-button" data-tab="instructions">
            <span class="tab-title">
              <span class="tab-main">
                <span class="tab-icon">📋</span>
                Instructions
              </span>
            </span>
          </button>
        </div>
        
        <!-- Tab Content -->
        <div class="tab-content">
          <div class="tab-pane active" data-pane="prompts"></div>
          <div class="tab-pane" data-pane="output"></div>
          <div class="tab-pane" data-pane="instructions"></div>
        </div>
        
        <!-- Desktop Side-by-Side Layout -->
        <div id="diff-output"></div>
      </div>
    `;
    
    this.diffContainer = this.querySelector('#diff-output') as HTMLElement;
    this.tabContainer = this.querySelector('.tab-navigation') as HTMLElement;
    this.tabContent = this.querySelector('.tab-content') as HTMLElement;
    this.setupTabListeners();
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

  private setupTabListeners() {
    const tabButtons = this.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Get the button element even if a child was clicked
        const buttonElement = (e.currentTarget as HTMLElement);
        const tab = buttonElement.getAttribute('data-tab') as 'prompts' | 'output' | 'instructions';
        if (tab) {
          this.switchTab(tab);
        }
      });
    });
  }

  private switchTab(tab: 'prompts' | 'output' | 'instructions') {
    // Update active tab
    this.activeTab = tab;
    
    // Update tab button states
    const tabButtons = this.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      const buttonTab = button.getAttribute('data-tab');
      button.classList.toggle('active', buttonTab === tab);
    });
    
    // Update tab pane visibility
    const tabPanes = this.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => {
      const paneTab = pane.getAttribute('data-pane');
      pane.classList.toggle('active', paneTab === tab);
    });
    
    // Re-render current revision content for the active tab
    if (this.currentRevisions.length > 0) {
      this.renderTabContent(this.currentRevisionIndex);
    }
  }

  // Render specific revision
  async renderRevision(revisionIndex: number) {
    this.currentRevisionIndex = revisionIndex;
    if (revisionIndex < 0 || revisionIndex >= this.currentRevisions.length) {
      return;
    }

    // Render both desktop and mobile layouts
    await this.renderDesktopLayout(revisionIndex);
    await this.renderTabContent(revisionIndex);
    
    // Update tab titles with change indicators
    this.updateTabTitles(revisionIndex);
  }

  private async renderDesktopLayout(revisionIndex: number) {
    if (!this.diffContainer) return;

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

      await this.renderFileContent(name, dir, displayName, container, revision, revisionIndex);
    }

    // Add instructions button to prompts container
    const promptsContainer = containers.get('prompts.txt');
    if (promptsContainer) {
      this.addInstructionsButton(promptsContainer, revision);
    }
  }

  private async renderTabContent(revisionIndex: number) {
    const revision = this.currentRevisions[revisionIndex];
    
    // Render content for active tab only (performance optimization)
    switch (this.activeTab) {
      case 'prompts':
        await this.renderTabPane('prompts', 'prompts.txt', this.basePath, 'Prompts', revision, revisionIndex);
        break;
      case 'output':
        await this.renderTabPane('output', 'output.md', this.basePath, 'Output', revision, revisionIndex);
        break;
      case 'instructions':
        await this.renderInstructionsTab(revision, revisionIndex);
        break;
    }
  }

  private async renderTabPane(tabName: string, fileName: string, dir: string, displayName: string, revision: any, revisionIndex: number) {
    const pane = this.querySelector(`[data-pane="${tabName}"]`) as HTMLElement;
    if (!pane) return;

    pane.innerHTML = '';
    await this.renderFileContent(fileName, dir, displayName, pane, revision, revisionIndex);
  }

  private async renderFileContent(fileName: string, dir: string, displayName: string, container: HTMLElement, revision: any, revisionIndex: number) {
    const fileInRev = revision.files.get(fileName);
    
    if (fileInRev) {
      // File changed in this revision
      if (fileInRev.revIdx === 0) {
        // First revision - show as all additions
        const content = await this.apiService.getFileContent(fileName, dir, fileInRev.revIdx);
        const diffContent = DiffRenderer.buildFirstRevision(displayName, content.split('\n'));
        DiffRenderer.renderDiffInContainer(container, diffContent, false, 'line-by-line');
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
        
        DiffRenderer.renderDiffInContainer(container, diffContent, unchanged, 'line-by-line');
      }
    } else {
      // Find most recent version of this file before current revision
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
      DiffRenderer.renderDiffInContainer(container, diffContent, true, 'line-by-line');
    }
  }

  private async renderInstructionsTab(revision: any, revisionIndex: number) {
    const pane = this.querySelector('[data-pane="instructions"]') as HTMLElement;
    if (!pane) return;

    pane.innerHTML = '';
    await this.renderFileContent('instructions.txt', '.', 'Instructions', pane, revision, revisionIndex);
  }

  private updateTabTitles(revisionIndex: number) {
    const revision = this.currentRevisions[revisionIndex];
    
    // Update tab titles with change indicators
    const promptsTab = this.querySelector('[data-tab="prompts"]') as HTMLElement;
    const outputTab = this.querySelector('[data-tab="output"]') as HTMLElement;
    const instructionsTab = this.querySelector('[data-tab="instructions"]') as HTMLElement;
    
    if (promptsTab) {
      const hasChanges = revision.files.has('prompts.txt');
      promptsTab.innerHTML = this.createTabContent('📝', 'Prompts', hasChanges);
      promptsTab.classList.toggle('has-changes', hasChanges);
    }
    
    if (outputTab) {
      const hasChanges = revision.files.has('output.md');
      outputTab.innerHTML = this.createTabContent('📄', 'Output', hasChanges);
      outputTab.classList.toggle('has-changes', hasChanges);
    }
    
    if (instructionsTab) {
      const hasChanges = revision.files.has('instructions.txt');
      instructionsTab.innerHTML = this.createTabContent('📋', 'Instructions', hasChanges);
      instructionsTab.classList.toggle('has-changes', hasChanges);
    }
  }

  private createTabContent(icon: string, title: string, hasChanges: boolean): string {
    return `
      <span class="tab-title">
        <span class="tab-main">
          <span class="tab-icon">${icon}</span>
          ${title}
        </span>
        ${hasChanges ? '<span class="change-badge">Changed</span>' : ''}
      </span>
    `;
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