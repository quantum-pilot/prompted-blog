import type { RevisionInfo } from '../types/index.js';
import { BaseComponent } from '../utils/base-component.js';

export class RevisionScroller extends BaseComponent {
  private progressLine!: HTMLElement;
  private thumb!: HTMLElement;
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private revisionText!: HTMLElement;
  private tickMarks: HTMLElement[] = [];
  private container!: HTMLElement;
  private revisions: RevisionInfo[] = [];
  private currentRev: number = 0;
  private onRevisionChange?: (revisionIndex: number) => void;
  private isDragging: boolean = false;

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
      <div id="revision-scroller" class="revision-navigation">
        <button class="nav-arrow prev-arrow icon-only secondary" 
                aria-label="Go to previous revision" title="Previous revision">
          <i class="fa fa-chevron-left" aria-hidden="true"></i>
        </button>
        <div class="progress-container">
          <div class="progress-line">
            <div class="progress-thumb" tabindex="0" role="slider" aria-label="Revision navigation"></div>
          </div>
          <div class="revision-text" aria-live="polite">Rev 1 / 1</div>
        </div>
        <button class="nav-arrow next-arrow icon-only secondary" 
                aria-label="Go to next revision" title="Next revision">
          <i class="fa fa-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    `;

    this.container = this.querySelector('#revision-scroller') as HTMLElement;
    this.progressLine = this.querySelector('.progress-line') as HTMLElement;
    this.thumb = this.querySelector('.progress-thumb') as HTMLElement;
    this.prevButton = this.querySelector('.prev-arrow') as HTMLButtonElement;
    this.nextButton = this.querySelector('.next-arrow') as HTMLButtonElement;
    this.revisionText = this.querySelector('.revision-text') as HTMLElement;

    this.setupEventListeners();
  }

  protected checkHistoryMode() {
    this.setVisible(this.urlService.isHistoryEnabled());
  }

  // Initialize with revision data
  setRevisions(revisions: RevisionInfo[], currentIndex: number = 0) {
    this.revisions = revisions;
    this.currentRev = currentIndex;
    this.buildScroller();
    this.setActiveRevision(currentIndex);
  }

  // Set callback for when revision changes
  onRevisionChanged(callback: (revisionIndex: number) => void) {
    this.onRevisionChange = callback;
  }

  private buildScroller() {
    if (!this.progressLine) return;

    // Clear existing tick marks
    this.tickMarks.forEach(tick => tick.remove());
    this.tickMarks = [];

    // Create tick marks for each revision using equidistant positioning
    for (let i = 0; i < this.revisions.length; i++) {
      const tick = document.createElement('div');
      tick.className = 'tick-mark';
      
      // Calculate equidistant position: position = (index / (total-1)) * 100%
      const position = this.revisions.length > 1 ? (i / (this.revisions.length - 1)) * 100 : 50;
      tick.style.left = `${position}%`;
      
      this.progressLine.appendChild(tick);
      this.tickMarks.push(tick);
    }

    this.updateThumbPosition();
    this.updateRevisionText();
    this.updateButtonStates();
  }

  private setActiveRevision(index: number) {
    const clampedIndex = Math.max(0, Math.min(index, this.revisions.length - 1));
    this.currentRev = clampedIndex;
    this.updateThumbPosition();
    this.updateRevisionText();
    this.updateButtonStates();
    this.updateURL(clampedIndex);
    
    if (this.onRevisionChange) {
      this.onRevisionChange(clampedIndex);
    }
  }

  private updateURL(revisionIndex: number) {
    this.urlService.setRevision(revisionIndex);
  }

  private setupEventListeners() {
    // Arrow button navigation
    this.addManagedEventListener(this.prevButton, 'click', () => {
      this.setActiveRevision(this.currentRev - 1);
      this.addTapFeedback(this.prevButton);
    });

    this.addManagedEventListener(this.nextButton, 'click', () => {
      this.setActiveRevision(this.currentRev + 1);
      this.addTapFeedback(this.nextButton);
    });

    // Progress line click-to-jump
    this.addManagedEventListener(this.progressLine, 'click', (e: Event) => {
      if (this.isDragging) return;
      const rect = this.progressLine.getBoundingClientRect();
      const x = (e as MouseEvent).clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      const targetIndex = this.getRevisionFromPercentage(percentage);
      this.setActiveRevision(targetIndex);
    });

    // Thumb drag functionality
    this.setupDragListeners();

    // Keyboard navigation
    this.addManagedEventListener(this.thumb, 'keydown', (e: Event) => {
      const keyEvent = e as KeyboardEvent;
      switch (keyEvent.key) {
        case 'ArrowLeft':
          keyEvent.preventDefault();
          this.setActiveRevision(this.currentRev - 1);
          break;
        case 'ArrowRight':
          keyEvent.preventDefault();
          this.setActiveRevision(this.currentRev + 1);
          break;
        case 'Home':
          keyEvent.preventDefault();
          this.setActiveRevision(0);
          break;
        case 'End':
          keyEvent.preventDefault();
          this.setActiveRevision(this.revisions.length - 1);
          break;
      }
    });
  }

  private setupDragListeners() {
    let startX = 0;
    let startPosition = 0;

    const handleStart = (clientX: number) => {
      this.isDragging = true;
      startX = clientX;
      const rect = this.progressLine.getBoundingClientRect();
      startPosition = ((this.currentRev / Math.max(1, this.revisions.length - 1)) * rect.width);
      this.thumb.style.transition = 'none';
      document.body.style.userSelect = 'none';
    };

    const handleMove = (clientX: number) => {
      if (!this.isDragging) return;
      
      const rect = this.progressLine.getBoundingClientRect();
      const deltaX = clientX - startX;
      const newPosition = Math.max(0, Math.min(rect.width, startPosition + deltaX));
      const percentage = (newPosition / rect.width) * 100;
      
      // Update thumb position visually during drag
      this.thumb.style.left = `${percentage}%`;
      
      // Update revision text with preview
      const targetIndex = this.getRevisionFromPercentage(percentage);
      this.revisionText.textContent = `Rev ${targetIndex + 1} / ${this.revisions.length}`;
    };

    const handleEnd = (clientX: number) => {
      if (!this.isDragging) return;
      
      const rect = this.progressLine.getBoundingClientRect();
      const deltaX = clientX - startX;
      const newPosition = Math.max(0, Math.min(rect.width, startPosition + deltaX));
      const percentage = (newPosition / rect.width) * 100;
      const targetIndex = this.getRevisionFromPercentage(percentage);
      
      this.isDragging = false;
      this.thumb.style.transition = '';
      document.body.style.userSelect = '';
      
      this.setActiveRevision(targetIndex);
      // Note: Removed addTapFeedback for drag operations to prevent visual displacement
    };

    // Mouse events
    this.addManagedEventListener(this.thumb, 'mousedown', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      mouseEvent.preventDefault();
      handleStart(mouseEvent.clientX);
    });

    this.addManagedEventListener(document, 'mousemove', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      handleMove(mouseEvent.clientX);
    });

    this.addManagedEventListener(document, 'mouseup', (e: Event) => {
      const mouseEvent = e as MouseEvent;
      handleEnd(mouseEvent.clientX);
    });

    // Touch events
    this.addManagedEventListener(this.thumb, 'touchstart', (e: Event) => {
      const touchEvent = e as TouchEvent;
      touchEvent.preventDefault();
      handleStart(touchEvent.touches[0].clientX);
    });

    this.addManagedEventListener(document, 'touchmove', (e: Event) => {
      const touchEvent = e as TouchEvent;
      handleMove(touchEvent.touches[0].clientX);
    }, { passive: false });

    this.addManagedEventListener(document, 'touchend', (e: Event) => {
      const touchEvent = e as TouchEvent;
      if (touchEvent.changedTouches.length > 0) {
        handleEnd(touchEvent.changedTouches[0].clientX);
      }
    });
  }

  private getRevisionFromPercentage(percentage: number): number {
    if (this.revisions.length <= 1) return 0;
    
    // Find the closest revision position
    let closestIndex = 0;
    let closestDistance = Infinity;
    
    for (let i = 0; i < this.revisions.length; i++) {
      const revisionPercentage = (i / (this.revisions.length - 1)) * 100;
      const distance = Math.abs(percentage - revisionPercentage);
      
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    
    return closestIndex;
  }

  private updateThumbPosition() {
    if (this.revisions.length <= 1) {
      this.thumb.style.left = '50%';
      return;
    }
    
    const percentage = (this.currentRev / (this.revisions.length - 1)) * 100;
    this.thumb.style.left = `${percentage}%`;
    
    // Update ARIA attributes
    this.thumb.setAttribute('aria-valuenow', this.currentRev.toString());
    this.thumb.setAttribute('aria-valuemin', '0');
    this.thumb.setAttribute('aria-valuemax', (this.revisions.length - 1).toString());
    this.thumb.setAttribute('aria-valuetext', `Revision ${this.currentRev + 1} of ${this.revisions.length}`);
  }

  private updateRevisionText() {
    this.revisionText.textContent = `Rev ${this.currentRev + 1} / ${this.revisions.length}`;
  }

  private updateButtonStates() {
    this.prevButton.disabled = this.currentRev === 0;
    this.nextButton.disabled = this.currentRev === this.revisions.length - 1;
    
    // Update ARIA attributes
    this.prevButton.setAttribute('aria-disabled', (this.currentRev === 0).toString());
    this.nextButton.setAttribute('aria-disabled', (this.currentRev === this.revisions.length - 1).toString());
  }

  private addTapFeedback(element: HTMLElement) {
    element.style.transform = 'scale(1.1)';
    setTimeout(() => {
      element.style.transform = '';
    }, 150);
  }

  // setVisible method now provided by BaseComponent

  // Get current revision index
  getCurrentRevision(): number {
    return this.currentRev;
  }
}

customElements.define('revision-scroller', RevisionScroller);
