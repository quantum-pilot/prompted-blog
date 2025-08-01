import type { PostData } from '../types/index.js';
import { UrlService } from '../services/url-service.js';

export class PostViewer extends HTMLElement {
  private urlService: UrlService;
  private postContainer!: HTMLElement;

  constructor() {
    super();
    this.urlService = UrlService.getInstance();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
    this.loadLatestPost();
  }

  private checkHistoryMode() {
    if (this.urlService.isHistoryEnabled()) {
      this.setVisible(false);
    }
  }

  private render() {
    this.innerHTML = `
      <main id="post-content" class="markdown-body" style="max-width: 800px; margin: 2rem auto; padding: 0 1rem;"></main>
    `;

    this.postContainer = this.querySelector('#post-content') as HTMLElement;
  }

  private async loadLatestPost() {
    try {
      const response = await fetch('latest.json');
      const basePath: string = await response.json();
      await this.loadPost(basePath);
    } catch (error) {
      console.error('Failed to load latest post:', error);
      if (this.postContainer) {
        this.postContainer.innerHTML = '<p>Failed to load latest post.</p>';
      }
    }
  }

  async loadPost(basePath: string) {
    try {
      const postResponse = await fetch(`${basePath}/index.html`);
      const html = await postResponse.text();

      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const post = tmp.querySelector('.markdown-body');

      if (post && this.postContainer) {
        // Clear existing content
        this.postContainer.innerHTML = '';
        this.postContainer.appendChild(post);
      }
    } catch (error) {
      console.error(`Failed to load post from ${basePath}:`, error);
      if (this.postContainer) {
        this.postContainer.innerHTML = '<p>Failed to load post.</p>';
      }
    }
  }

  // Method to hide/show post viewer based on history mode
  setVisible(visible: boolean) {
    this.style.display = visible ? 'block' : 'none';
  }
}

customElements.define('post-viewer', PostViewer);
