import { BaseComponent } from '../utils/base-component.js';

export class BlogHeader extends BaseComponent {
  private historyButton!: HTMLButtonElement;
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private isHistoryActive: boolean = false;
  private currentPostPath: string | null = null;

  constructor() {
    super();
    this.isHistoryActive = this.urlService.isHistoryEnabled();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  protected cleanup() {
    // BaseComponent handles event cleanup automatically
  }

  private render() {
    this.innerHTML = `
      <header class="header">
        <div class="header-content">
          <h1>Prompted Blog</h1>
          <p class="description">Prompt-driven commit history as a blog. One prompt at a time.</p>
        </div>
        <button class="history-button ${this.isHistoryActive ? 'active' : ''}" id="history-trigger" title="Toggle Prompt History">
          <i class="fas fa-history"></i>
        </button>
      </header>
      <nav class="navigation-bar">
        <button class="nav-button prev-post" id="prev-button" disabled title="Previous Post">
          <span class="button-icon">←</span>
          <span class="button-text">← Prev</span>
        </button>
        <button class="nav-button next-post" id="next-button" disabled title="Next Post">
          <span class="button-icon">→</span>
          <span class="button-text">Next →</span>
        </button>
      </nav>
    `;
    
    this.historyButton = this.querySelector('#history-trigger') as HTMLButtonElement;
    this.prevButton = this.querySelector('#prev-button') as HTMLButtonElement;
    this.nextButton = this.querySelector('#next-button') as HTMLButtonElement;
  }

  private attachEventListeners() {
    const historyHandler = () => this.toggleHistory();
    const prevHandler = async () => await this.navigateToPrev();
    const nextHandler = async () => await this.navigateToNext();

    this.addManagedEventListener(this.historyButton, 'click', historyHandler);
    this.addManagedEventListener(this.prevButton, 'click', prevHandler);
    this.addManagedEventListener(this.nextButton, 'click', nextHandler);
  }

  private toggleHistory() {
    this.isHistoryActive = !this.isHistoryActive;
    this.historyButton.classList.toggle('active', this.isHistoryActive);
    this.urlService.setHistoryEnabled(this.isHistoryActive);
  }

  private async navigateToPrev() {
    if (!this.currentPostPath) return;
    
    try {
      const adjacent = await this.apiService.getAdjacentPosts(this.currentPostPath);
      if (adjacent.prev) {
        this.urlService.navigateToPost(adjacent.prev);
      }
    } catch (error) {
      this.errorHandler.handleNavigationError(error as Error, 'previous post');
    }
  }

  private async navigateToNext() {
    if (!this.currentPostPath) return;
    
    try {
      const adjacent = await this.apiService.getAdjacentPosts(this.currentPostPath);
      if (adjacent.next) {
        this.urlService.navigateToPost(adjacent.next);
      }
    } catch (error) {
      this.errorHandler.handleNavigationError(error as Error, 'next post');
    }
  }

  async setCurrentPost(postPath: string) {
    this.currentPostPath = postPath;
    await this.updateNavigationButtons();
  }

  private async updateNavigationButtons() {
    if (!this.currentPostPath) {
      this.prevButton.disabled = true;
      this.nextButton.disabled = true;
      return;
    }

    const adjacent = await this.apiService.getAdjacentPosts(this.currentPostPath);
    this.prevButton.disabled = !adjacent.prev;
    this.nextButton.disabled = !adjacent.next;
  }
}

customElements.define('blog-header', BlogHeader);