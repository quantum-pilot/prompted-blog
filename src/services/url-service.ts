export class UrlService {
  private static instance: UrlService;

  private constructor() {}

  static getInstance(): UrlService {
    if (!UrlService.instance) {
      UrlService.instance = new UrlService();
    }
    return UrlService.instance;
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
}