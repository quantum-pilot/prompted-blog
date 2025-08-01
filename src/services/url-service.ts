export class UrlService {
  private static instance: UrlService;
  private hashChangeListeners: ((postPath: string | null) => void)[] = [];

  private constructor() {
    this.setupHashListener();
  }

  static getInstance(): UrlService {
    if (!UrlService.instance) {
      UrlService.instance = new UrlService();
    }
    return UrlService.instance;
  }

  private setupHashListener(): void {
    window.addEventListener('hashchange', () => {
      const postPath = this.getPostPathFromHash();
      this.hashChangeListeners.forEach(listener => listener(postPath));
    });
  }

  // Get current URL object
  getUrl(): URL {
    return new URL(window.location.href);
  }

  // Check if history mode is enabled
  isHistoryEnabled(): boolean {
    return this.getUrl().searchParams.get('history_enabled') === 'true';
  }

  // Get current revision index from URL
  getCurrentRevision(): number | null {
    const rev = this.getUrl().searchParams.get('rev');
    return rev ? parseInt(rev, 10) : null;
  }

  // Set history mode
  setHistoryEnabled(enabled: boolean): void {
    const url = this.getUrl();
    if (enabled) {
      url.searchParams.set('history_enabled', 'true');
    } else {
      url.searchParams.delete('history_enabled');
      url.searchParams.delete('rev'); // Also remove revision when disabling history
    }
    window.location.href = url.toString();
  }

  // Set revision index
  setRevision(revisionIndex: number): void {
    const url = this.getUrl();
    url.searchParams.set('rev', revisionIndex.toString());
    history.replaceState(null, '', url.toString());
  }

  // Update URL without navigation
  updateUrl(params: { [key: string]: string | null }): void {
    const url = this.getUrl();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    history.replaceState(null, '', url.toString());
  }

  // Navigate to URL
  navigateTo(params: { [key: string]: string | null }): void {
    const url = this.getUrl();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    });

    window.location.href = url.toString();
  }

  // Get base path without query parameters
  getBasePath(): string {
    const url = this.getUrl();
    return `${url.origin}${url.pathname}`;
  }

  // Get post path from hash (e.g., #/posts/2024-01-20/ returns "posts/2024-01-20")
  getPostPathFromHash(): string | null {
    const hash = window.location.hash;
    const match = hash.match(/^#\/posts\/(\d{4}-\d{2}-\d{2})\/$/);
    if (match) {
      return `posts/${match[1]}`;
    }
    return null;
  }

  // Navigate to a specific post
  navigateToPost(postPath: string): void {
    const datePart = postPath.match(/posts\/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (datePart) {
      const newHash = `#/posts/${datePart}/`;
      // Just change the hash, the hashchange event will handle the rest
      window.location.hash = newHash;
    }
  }

  // Navigate to the root (latest post)
  navigateToRoot(): void {
    if (this.isHistoryEnabled()) {
      window.location.hash = '#/';
    } else {
      window.location.hash = '#/';
      window.location.reload();
    }
  }

  // Listen for hash changes
  onHashChange(listener: (postPath: string | null) => void): void {
    this.hashChangeListeners.push(listener);
  }

  // Remove hash change listener
  offHashChange(listener: (postPath: string | null) => void): void {
    const index = this.hashChangeListeners.indexOf(listener);
    if (index !== -1) {
      this.hashChangeListeners.splice(index, 1);
    }
  }
}