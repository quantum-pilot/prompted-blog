import { UrlService } from '../services/url-service.js';

export class BlogHeader extends HTMLElement {
  private historyButton!: HTMLButtonElement;
  private isHistoryActive: boolean = false;
  private urlService: UrlService;

  constructor() {
    super();
    this.urlService = UrlService.getInstance();
    this.isHistoryActive = this.urlService.isHistoryEnabled();
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
  }

  private render() {
    this.innerHTML = `
      <header class="header">
        <h1>Prompted Blog</h1>
        <p class="description">Prompt-driven commit history as a blog. One prompt at a time.</p>
        <button class="history-button ${this.isHistoryActive ? 'active' : ''}" id="history-trigger" title="Toggle Prompt History">
          <i class="fas fa-history"></i>
        </button>
      </header>
    `;
    
    this.historyButton = this.querySelector('#history-trigger') as HTMLButtonElement;
  }

  private attachEventListeners() {
    this.historyButton.addEventListener('click', () => {
      this.toggleHistory();
    });
  }

  private toggleHistory() {
    this.isHistoryActive = !this.isHistoryActive;
    this.historyButton.classList.toggle('active', this.isHistoryActive);
    this.urlService.setHistoryEnabled(this.isHistoryActive);
  }
}

customElements.define('blog-header', BlogHeader);