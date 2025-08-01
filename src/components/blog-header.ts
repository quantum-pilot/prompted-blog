import { UrlService } from '../services/url-service.js';
import { ApiService } from '../services/api-service.js';
import { ErrorHandler } from '../utils/error-handler.js';

export class BlogHeader extends HTMLElement {
  private historyButton!: HTMLButtonElement;
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private isHistoryActive: boolean = false;
  private urlService: UrlService;
  private apiService: ApiService;
  private currentPostPath: string | null = null;
  private eventListeners: Array<{ element: Element; event: string; handler: EventListener }> = [];
  private errorHandler: ErrorHandler;

  constructor() {
    super();
    this.urlService = UrlService.getInstance();
    this.apiService = ApiService.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.isHistoryActive = this.urlService.isHistoryEnabled();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  disconnectedCallback() {
    this.cleanup();
  }

  private cleanup() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }

  private render() {
    this.innerHTML = `
      <header class="header">
        <button class="nav-button prev-post" id="prev-button" disabled>← Prev</button>
        <div class="header-content">
          <h1>Prompted Blog</h1>
          <p class="description">Prompt-driven commit history as a blog. One prompt at a time.</p>
          <button class="history-button ${this.isHistoryActive ? 'active' : ''}" id="history-trigger" title="Toggle Prompt History">
            <i class="fas fa-history"></i>
          </button>
        </div>
        <button class="nav-button next-post" id="next-button" disabled>Next →</button>
      </header>
    `;
    
    this.historyButton = this.querySelector('#history-trigger') as HTMLButtonElement;
    this.prevButton = this.querySelector('#prev-button') as HTMLButtonElement;
    this.nextButton = this.querySelector('#next-button') as HTMLButtonElement;
  }

  private attachEventListeners() {
    const historyHandler = () => this.toggleHistory();
    const prevHandler = async () => await this.navigateToPrev();
    const nextHandler = async () => await this.navigateToNext();

    this.historyButton.addEventListener('click', historyHandler);
    this.prevButton.addEventListener('click', prevHandler);
    this.nextButton.addEventListener('click', nextHandler);

    this.eventListeners.push(
      { element: this.historyButton, event: 'click', handler: historyHandler },
      { element: this.prevButton, event: 'click', handler: prevHandler },
      { element: this.nextButton, event: 'click', handler: nextHandler }
    );
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