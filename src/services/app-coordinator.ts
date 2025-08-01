import { ApiService } from './api-service.js';
import { UrlService } from './url-service.js';
import { createSingleton } from '../utils/singleton.js';
import type { BlogHeader } from '../components/blog-header.js';
import type { PostViewer } from '../components/post-viewer.js';
import type { RevisionScroller } from '../components/revision-scroller.js';
import type { InstructionsModal } from '../components/instructions-modal.js';
import type { DiffViewer } from '../components/diff-viewer.js';
import type { RevisionData } from '../types/index.js';

export class AppCoordinator {
  private apiService: ApiService;
  private urlService: UrlService;
  private components: {
    header?: BlogHeader;
    postViewer?: PostViewer;
    revisionScroller?: RevisionScroller;
    instructionsModal?: InstructionsModal;
    diffViewer?: DiffViewer;
  } = {};
  private currentRevisions: RevisionData[] = [];
  private basePath: string = '';
  private popstateHandler: () => void;
  private hashChangeHandler: (postPath: string | null) => Promise<void>;

  private constructor() {
    this.apiService = ApiService.getInstance();
    this.urlService = UrlService.getInstance();
    
    // Initialize handlers
    this.popstateHandler = () => {
      this.init(); // Re-initialize based on new URL state
    };
    
    this.hashChangeHandler = async (postPath: string | null) => {
      if (postPath && postPath !== this.basePath) {
        // Navigate to the new post
        this.basePath = postPath;
        
        // Update header with current post
        if (this.components.header) {
          await this.components.header.setCurrentPost(this.basePath);
        }

        // Re-initialize based on current state
        if (this.urlService.isHistoryEnabled()) {
          await this.initHistoryMode();
        } else {
          await this.initNormalMode();
        }
      }
    };
  }

  static getInstance = createSingleton<AppCoordinator>(AppCoordinator);

  // Initialize the application
  async init(): Promise<void> {
    try {
      // Get components
      this.components.header = document.querySelector('blog-header') as BlogHeader;
      this.components.postViewer = document.querySelector('post-viewer') as PostViewer;
      this.components.revisionScroller = document.querySelector('revision-scroller') as RevisionScroller;
      this.components.instructionsModal = document.querySelector('instructions-modal') as InstructionsModal;
      this.components.diffViewer = document.querySelector('diff-viewer') as DiffViewer;

      // Check if we have a specific post in the hash
      const postFromHash = this.urlService.getPostPathFromHash();
      
      if (postFromHash) {
        // Use the post from the hash
        this.basePath = postFromHash;
      } else {
        // Get latest post path and navigate to it
        this.basePath = await this.apiService.getLatestPost();
        // Update URL to show the specific post
        this.urlService.navigateToPost(this.basePath);
        return; // navigateToPost will reload, so we exit here
      }

      // Update header with current post
      if (this.components.header) {
        await this.components.header.setCurrentPost(this.basePath);
      }

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

    // Load the post content
    if (this.components.postViewer) {
      await this.components.postViewer.loadPost(this.basePath);
    }
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
    
    // Initialize instructions modal with revision data
    if (this.components.instructionsModal) {
      await this.components.instructionsModal.initialize(this.currentRevisions);
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
      
      await this.components.instructionsModal.loadInstructions(revision, revisionIndex);
    }
  }

  private handleRevisionChange(revisionIndex: number): void {
    this.loadRevision(revisionIndex);
  }

  private setupEventListeners(): void {
    // Clean up existing listeners first
    this.cleanup();
    
    // Listen for history mode toggles
    if (this.components.header) {
      // The header component already handles its own click events
      // but we could add additional coordination here if needed
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', this.popstateHandler);

    // Handle hash changes for post navigation
    this.urlService.onHashChange(this.hashChangeHandler);
  }

  // Cleanup method for proper resource management
  cleanup(): void {
    // Remove window event listeners
    window.removeEventListener('popstate', this.popstateHandler);
    
    // Remove hash change listener from UrlService
    this.urlService.offHashChange(this.hashChangeHandler);
  }

  // Public methods for components to use
  getBasePath(): string {
    return this.basePath;
  }

  getCurrentRevisions(): RevisionData[] {
    return this.currentRevisions;
  }

  async getApiService(): Promise<ApiService> {
    return this.apiService;
  }

  getUrlService(): UrlService {
    return this.urlService;
  }
}