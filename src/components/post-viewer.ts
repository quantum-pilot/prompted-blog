import type { PostData } from '../types/index.js';
import { BaseComponent } from '../utils/base-component.js';

export class PostViewer extends BaseComponent {
  private postContainer!: HTMLElement;

  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.checkHistoryMode();
    this.loadLatestPost();
  }

  protected checkHistoryMode() {
    // Show post viewer only when history mode is disabled
    this.setVisible(!this.urlService.isHistoryEnabled());
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
      const fallbackMessage = this.handleError(error as Error, 'loading latest post', {
        showUser: true,
        fallback: '<p>Failed to load latest post.</p>'
      });
      if (this.postContainer) {
        this.postContainer.innerHTML = fallbackMessage;
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
      const fallbackMessage = this.handleError(error as Error, `loading post from ${basePath}`, {
        showUser: true,
        fallback: '<p>Failed to load post.</p>'
      });
      if (this.postContainer) {
        this.postContainer.innerHTML = fallbackMessage;
      }
    }
  }

  // setVisible method now provided by BaseComponent
}

customElements.define('post-viewer', PostViewer);
