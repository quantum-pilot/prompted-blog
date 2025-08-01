/**
 * Theme Manager - Handles theme detection, persistence, and switching
 */

export type Theme = 'light' | 'dark';

class ThemeManager {
  private static instance: ThemeManager;
  private currentTheme: Theme;
  private readonly STORAGE_KEY = 'prompted-blog-theme';

  private constructor() {
    this.currentTheme = this.detectInitialTheme();
    this.applyTheme(this.currentTheme);
    this.setupSystemThemeListener();
    // Ensure theme persists across navigation
    this.setupNavigationListener();
  }

  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * Detect initial theme based on localStorage or system preference
   */
  private detectInitialTheme(): Theme {
    // Check localStorage first
    const storedTheme = localStorage.getItem(this.STORAGE_KEY) as Theme | null;
    if (storedTheme && (storedTheme === 'light' || storedTheme === 'dark')) {
      return storedTheme;
    }

    // Fall back to system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    return 'light';
  }

  /**
   * Apply theme to document
   */
  private applyTheme(theme: Theme): void {
    // Add no-transition class to prevent flash during initial load
    if (!document.documentElement.hasAttribute('data-theme')) {
      document.documentElement.classList.add('no-transition');
    }

    document.documentElement.setAttribute('data-theme', theme);

    // Remove no-transition class after a frame
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('no-transition');
    });
  }

  /**
   * Setup listener for system theme changes
   */
  private setupSystemThemeListener(): void {
    if (!window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      // Only react to system changes if user hasn't set a preference
      if (!localStorage.getItem(this.STORAGE_KEY)) {
        this.setTheme(e.matches ? 'dark' : 'light', false);
      }
    });
  }

  /**
   * Setup listener for navigation events to ensure theme persists
   */
  private setupNavigationListener(): void {
    // Listen for hash changes and popstate events
    const ensureTheme = () => {
      // Re-apply theme if it's been lost
      if (!document.documentElement.hasAttribute('data-theme')) {
        this.applyTheme(this.currentTheme);
      }
    };

    window.addEventListener('hashchange', ensureTheme);
    window.addEventListener('popstate', ensureTheme);
  }

  /**
   * Get current theme
   */
  getTheme(): Theme {
    return this.currentTheme;
  }

  /**
   * Set theme and optionally persist to localStorage
   */
  setTheme(theme: Theme, persist: boolean = true): void {
    this.currentTheme = theme;
    this.applyTheme(theme);

    if (persist) {
      localStorage.setItem(this.STORAGE_KEY, theme);
    }
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Clear user preference and revert to system theme
   */
  clearPreference(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentTheme = this.detectInitialTheme();
    this.applyTheme(this.currentTheme);
  }

  /**
   * Force re-apply current theme (useful if theme gets lost during navigation)
   */
  reapplyTheme(): void {
    this.applyTheme(this.currentTheme);
  }
}

// Export singleton instance
export const themeManager = ThemeManager.getInstance();
