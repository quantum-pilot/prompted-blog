export class BlogHeader extends HTMLElement {
  private historyButton!: HTMLButtonElement;
  private isHistoryActive: boolean = false;

  constructor() {
    super();
    this.isHistoryActive = new URL(window.location.href).searchParams.get('history_enabled') === 'true';
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
    const url = new URL(window.location.href);
    this.isHistoryActive = !this.isHistoryActive;
    
    this.historyButton.classList.toggle('active', this.isHistoryActive);
    
    if (this.isHistoryActive) {
      url.searchParams.set('history_enabled', 'true');
    } else {
      url.searchParams.delete('history_enabled');
    }
    
    window.location.href = url.toString();
  }
}

customElements.define('blog-header', BlogHeader);