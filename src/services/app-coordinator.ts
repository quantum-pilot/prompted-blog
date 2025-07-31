import { ApiService } from './api-service.js';
import { UrlService } from './url-service.js';
import type { BlogHeader } from '../components/blog-header.js';
import type { PostViewer } from '../components/post-viewer.js';
import type { RevisionScroller } from '../components/revision-scroller.js';
import type { InstructionsModal } from '../components/instructions-modal.js';
import type { DiffViewer } from '../components/diff-viewer.js';

export class AppCoordinator {
  private static instance: AppCoordinator;
  private apiService: ApiService;
  private urlService: UrlService;
  private components: {
    header?: BlogHeader;
    postViewer?: PostViewer;
    revisionScroller?: RevisionScroller;
    instructionsModal?: InstructionsModal;
    diffViewer?: DiffViewer;
  } = {};
  private currentRevisions: { date: string; files: Map<string, any> }[] = [];
  private basePath: string = '';

  private constructor() {
    this.apiService = ApiService.getInstance();
    this.urlService = UrlService.getInstance();
  }

  static getInstance(): AppCoordinator {
    if (!AppCoordinator.instance) {
      AppCoordinator.instance = new AppCoordinator();
    }
    return AppCoordinator.instance;
  }

  // Initialize the application
  async init(): Promise<void> {
    try {
      // Get components
      this.components.header = document.querySelector('blog-header') as BlogHeader;
      this.components.postViewer = document.querySelector('post-viewer') as PostViewer;
      this.components.revisionScroller = document.querySelector('revision-scroller') as RevisionScroller;
      this.components.instructionsModal = document.querySelector('instructions-modal') as InstructionsModal;
      this.components.diffViewer = document.querySelector('diff-viewer') as DiffViewer;

      // Get latest post path
      this.basePath = await this.apiService.getLatestPost();

      // Initialize based on current URL state
      if (this.urlService.isHistoryEnabled()) {
        await this.initHistoryMode();
      } else {
        await this.initNormalMode();
      }

      // Set up event listeners
      this.setupEventListeners();

    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  private async initNormalMode(): Promise<void> {
    // Show post viewer, hide others
    this.components.postViewer?.setVisible(true);
    this.components.revisionScroller?.setVisible(false);
    this.components.instructionsModal?.setVisible(false);
    this.components.diffViewer?.setVisible(false);
  }

  private async initHistoryMode(): Promise<void> {
    // Hide post viewer, show history components
    this.components.postViewer?.setVisible(false);
    this.components.revisionScroller?.setVisible(true);
    this.components.instructionsModal?.setVisible(true);
    this.components.diffViewer?.setVisible(true);

    // Load revision data
    this.currentRevisions = await this.apiService.getMergedRevisions(this.basePath);
    
    // Initialize diff viewer with revision data
    if (this.components.diffViewer) {
      await this.components.diffViewer.initialize(this.currentRevisions, this.basePath);
    }
    
    // Get current revision from URL or default to latest
    const currentRev = this.urlService.getCurrentRevision() ?? (this.currentRevisions.length - 1);
    const clampedRev = Math.max(0, Math.min(currentRev, this.currentRevisions.length - 1));

    // Initialize revision scroller
    if (this.components.revisionScroller && this.currentRevisions.length > 0) {
      const revisionInfos = this.currentRevisions.map(rev => ({
        hash: rev.files.values().next().value?.hash || '',
        date: rev.date
      }));
      
      this.components.revisionScroller.setRevisions(revisionInfos, clampedRev);
      this.components.revisionScroller.onRevisionChanged((index) => {
        this.handleRevisionChange(index);
      });
    }

    // Load content for current revision
    await this.loadRevision(clampedRev);
  }

  private async loadRevision(revisionIndex: number): Promise<void> {
    if (revisionIndex < 0 || revisionIndex >= this.currentRevisions.length) return;

    const revision = this.currentRevisions[revisionIndex];
    
    // Update URL
    this.urlService.setRevision(revisionIndex);

    // Render diff content
    if (this.components.diffViewer) {
      await this.components.diffViewer.renderRevision(revisionIndex);
    }

    // Check if instructions changed in this revision
    const instructionsHasChanges = revision.files.has('instructions.txt');
    
    // Load instructions content for modal
    if (this.components.instructionsModal) {
      this.components.instructionsModal.setHasChanges(instructionsHasChanges);
      
      // Find the revision index for instructions.txt specifically
      let instructionsRevIndex = 0;
      if (instructionsHasChanges) {
        const instructionsInfo = revision.files.get('instructions.txt');
        instructionsRevIndex = instructionsInfo?.revIdx || 0;
      } else {
        // Find most recent instructions version
        for (let i = revisionIndex - 1; i >= 0; i--) {
          if (this.currentRevisions[i].files.has('instructions.txt')) {
            const instructionsInfo = this.currentRevisions[i].files.get('instructions.txt');
            instructionsRevIndex = instructionsInfo?.revIdx || 0;
            break;
          }
        }
      }
      
      await this.components.instructionsModal.loadInstructions(instructionsRevIndex);
    }
  }

  private handleRevisionChange(revisionIndex: number): void {
    this.loadRevision(revisionIndex);
  }

  private setupEventListeners(): void {
    // Listen for history mode toggles
    if (this.components.header) {
      // The header component already handles its own click events
      // but we could add additional coordination here if needed
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.init(); // Re-initialize based on new URL state
    });
  }

  // Public methods for components to use
  getBasePath(): string {
    return this.basePath;
  }

  getCurrentRevisions(): { date: string; files: Map<string, any> }[] {
    return this.currentRevisions;
  }

  async getApiService(): Promise<ApiService> {
    return this.apiService;
  }

  getUrlService(): UrlService {
    return this.urlService;
  }
}