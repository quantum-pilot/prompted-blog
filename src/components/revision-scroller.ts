import type { RevisionInfo } from '../types/index.js';
import { UrlService } from '../services/url-service.js';

export class RevisionScroller extends HTMLElement {
  private dots: HTMLElement[] = [];
  private scrollIconContainer!: HTMLElement;
  private revisions: RevisionInfo[] = [];
  private currentRev: number = 0;
  private onRevisionChange?: (revisionIndex: number) => void;
  private urlService: UrlService;

  constructor() {
    super();
    this.urlService = UrlService.getInstance();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
  }

  private render() {
    this.innerHTML = `
      <div id="revision-scroller" style="position: fixed; bottom: 5%; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; align-items: center;">
      </div>
    `;

    this.scrollIconContainer = this.querySelector('#revision-scroller') as HTMLElement;
  }

  private checkHistoryMode() {
    this.setVisible(this.urlService.isHistoryEnabled());
  }

  // Initialize with revision data
  setRevisions(revisions: RevisionInfo[], currentIndex: number = 0) {
    this.revisions = revisions;
    this.currentRev = currentIndex;
    this.buildScroller();
    this.setActiveDot(currentIndex);
  }

  // Set callback for when revision changes
  onRevisionChanged(callback: (revisionIndex: number) => void) {
    this.onRevisionChange = callback;
  }

  private buildScroller() {
    if (!this.scrollIconContainer) return;

    // Clear existing dots
    this.scrollIconContainer.innerHTML = '';
    this.dots = [];

    // Create dots for each revision
    for (let i = 0; i < this.revisions.length; i++) {
      const dot = document.createElement('div');
      dot.className = 'rev-dot';
      dot.style.cssText = `
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ccc;
        cursor: pointer;
      `;

      dot.addEventListener('click', () => {
        this.setActiveDot(i);
        this.updateURL(i);
        if (this.onRevisionChange) {
          this.onRevisionChange(i);
        }
      });

      this.dots.push(dot);
      this.scrollIconContainer.appendChild(dot);
    }

    // Add scroll icon
    const scrollIcon = document.createElement('div');
    scrollIcon.className = 'rev-scroll-icon';
    scrollIcon.style.cssText = `
      width: 24px;
      height: 24px;
      background: url('assets/scroll-icon.svg') center center no-repeat;
      background-size: contain;
    `;
    this.scrollIconContainer.appendChild(scrollIcon);
  }

  private setActiveDot(index: number) {
    this.currentRev = index;
    this.dots.forEach((dot, i) => {
      if (i === index) {
        dot.style.background = '#333';
      } else {
        dot.style.background = '#ccc';
      }
    });
  }

  private updateURL(revisionIndex: number) {
    this.urlService.setRevision(revisionIndex);
  }

  setVisible(visible: boolean) {
    this.style.display = visible ? 'block' : 'none';
  }

  // Get current revision index
  getCurrentRevision(): number {
    return this.currentRev;
  }
}

customElements.define('revision-scroller', RevisionScroller);
