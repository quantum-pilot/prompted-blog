import { BaseComponent } from '../utils/base-component.js';
import { themeManager } from '../utils/theme-manager.js';

export class BlogHeader extends BaseComponent {
  private historyButton!: HTMLButtonElement;
  private themeToggle!: HTMLButtonElement;
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
    const currentTheme = themeManager.getTheme();
    const themeTitle = `Switch to ${currentTheme === 'light' ? 'dark' : 'light'} theme`;
    
    this.innerHTML = `
      <header class="header">
        <div class="header-content">
          <h1>Prompted Blog</h1>
          <p class="description">Prompt-driven commit history as a blog. One prompt at a time.</p>
        </div>
      </header>
      <nav class="navigation-bar">
        <button class="theme-toggle icon-only" id="theme-toggle" title="${themeTitle}" 
                aria-label="${themeTitle}" role="switch" aria-checked="${currentTheme === 'dark'}">
          <div class="theme-toggle-track">
            <div class="theme-toggle-slider ${currentTheme}"></div>
            <div class="theme-icon dark-icon">
              <i class="fas fa-moon" aria-hidden="true"></i>
            </div>
            <div class="theme-icon light-icon">
              <i class="fas fa-sun" aria-hidden="true"></i>
            </div>
          </div>
        </button>
        <div class="nav-controls">
          <button class="nav-button prev-post secondary" id="prev-button" disabled 
                  title="Previous Post" aria-label="Navigate to previous blog post">
            <span class="button-icon" aria-hidden="true">←</span>
            <span class="button-text">← Prev</span>
          </button>
          <button class="nav-button next-post secondary" id="next-button" disabled 
                  title="Next Post" aria-label="Navigate to next blog post">
            <span class="button-icon" aria-hidden="true">→</span>
            <span class="button-text">Next →</span>
          </button>
        </div>
        <button class="history-button icon-only ${this.isHistoryActive ? 'active' : ''}" id="history-trigger" 
                title="Toggle Prompt History" aria-label="Toggle revision history view" 
                aria-pressed="${this.isHistoryActive}">
          <i class="fas fa-history" aria-hidden="true"></i>
        </button>
      </nav>
    `;
    
    this.historyButton = this.querySelector('#history-trigger') as HTMLButtonElement;
    this.themeToggle = this.querySelector('#theme-toggle') as HTMLButtonElement;
    this.prevButton = this.querySelector('#prev-button') as HTMLButtonElement;
    this.nextButton = this.querySelector('#next-button') as HTMLButtonElement;
  }

  private attachEventListeners() {
    const historyHandler = () => this.toggleHistory();
    const themeHandler = () => this.toggleTheme();
    const prevHandler = async () => await this.navigateToPrev();
    const nextHandler = async () => await this.navigateToNext();

    this.addManagedEventListener(this.historyButton, 'click', historyHandler);
    this.addManagedEventListener(this.themeToggle, 'click', themeHandler);
    this.addManagedEventListener(this.prevButton, 'click', prevHandler);
    this.addManagedEventListener(this.nextButton, 'click', nextHandler);
  }

  private toggleHistory() {
    this.isHistoryActive = !this.isHistoryActive;
    this.historyButton.classList.toggle('active', this.isHistoryActive);
    this.historyButton.setAttribute('aria-pressed', this.isHistoryActive.toString());
    this.urlService.setHistoryEnabled(this.isHistoryActive);
  }

  private toggleTheme() {
    themeManager.toggleTheme();
    this.updateThemeButton();
  }

  private updateThemeButton() {
    const currentTheme = themeManager.getTheme();
    const slider = this.themeToggle.querySelector('.theme-toggle-slider') as HTMLElement;
    const themeTitle = `Switch to ${currentTheme === 'light' ? 'dark' : 'light'} theme`;
    
    // Update slider position
    slider.className = `theme-toggle-slider ${currentTheme}`;
    
    // Update tooltip and accessibility attributes
    this.themeToggle.title = themeTitle;
    this.themeToggle.setAttribute('aria-label', themeTitle);
    this.themeToggle.setAttribute('aria-checked', (currentTheme === 'dark').toString());
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