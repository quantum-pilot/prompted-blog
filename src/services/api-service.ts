import type { RevisionInfo, FileRevisions, RevisionData, AdjacentPosts } from '../types/index.js';
import { ErrorHandler } from '../utils/error-handler.js';
import { createSingleton } from '../utils/singleton.js';

export class ApiService {
  private cache: Map<string, any> = new Map();
  private errorHandler: ErrorHandler;

  private constructor() {
    this.errorHandler = ErrorHandler.getInstance();
  }

  static getInstance = createSingleton<ApiService>(ApiService);

  private cacheKey(type: string, ...parts: (string | number)[]): string {
    return [type, ...parts].join('-');
  }

  // Fetch latest post path
  async getLatestPost(): Promise<string> {
    const cacheKey = this.cacheKey('latest');
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    return this.errorHandler.wrap(
      async () => {
        const response = await fetch('latest.json');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const basePath: string = await response.json();
        this.cache.set(cacheKey, basePath);
        return basePath;
      },
      {
        message: 'Failed to fetch latest post',
        code: 'LATEST_POST_ERROR'
      },
      {
        showUserMessage: true,
        fallbackValue: 'posts/fallback'
      }
    );
  }

  // Fetch post HTML content
  async getPostContent(basePath: string): Promise<string> {
    const cacheKey = this.cacheKey('post', basePath);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${basePath}/index.html`);
      const html = await response.text();
      this.cache.set(cacheKey, html);
      return html;
    } catch (error) {
      console.error('Failed to fetch post content:', error);
      throw error;
    }
  }

  // Fetch file revisions
  async getFileRevisions(fileName: string, dir: string = '.'): Promise<RevisionInfo[]> {
    const cacheKey = this.cacheKey('revisions', dir, fileName);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    return this.errorHandler.wrap(
      async () => {
        const response = await fetch(`${dir}/diff_cache/${fileName}/revisions.json`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const revisions: RevisionInfo[] = await response.json();
        this.cache.set(cacheKey, revisions);
        return revisions;
      },
      {
        message: `Failed to fetch revisions for ${fileName}`,
        code: 'REVISIONS_ERROR',
        context: { fileName, dir }
      },
      {
        showUserMessage: false,
        fallbackValue: []
      }
    );
  }

  // Fetch all file revisions for a post
  async getAllFileRevisions(basePath: string): Promise<FileRevisions[]> {
    const targets = [
      { name: 'instructions.txt', dir: '.' },
      { name: 'prompts.txt', dir: basePath },
      { name: 'output.md', dir: basePath }
    ];

    const results = await Promise.all(
      targets.map(async ({ name, dir }) => {
        const list = await this.getFileRevisions(name, dir);
        return { name, dir, list };
      })
    );

    return results;
  }

  // Get merged and sorted revisions from all files
  async getMergedRevisions(basePath: string): Promise<RevisionData[]> {
    const files = await this.getAllFileRevisions(basePath);
    const allRevisions = new Map<string, RevisionData>();

    files.forEach(({ name, dir, list }) => {
      list.forEach((rev, idx) => {
        const key = rev.date;
        if (!allRevisions.has(key)) {
          allRevisions.set(key, { date: rev.date, files: new Map() });
        }
        allRevisions.get(key)!.files.set(name, { name, dir, revIdx: idx, hash: rev.hash });
      });
    });

    return Array.from(allRevisions.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Fetch diff content for a file at specific revision
  async getDiff(fileName: string, dir: string, revisionIndex: number): Promise<string | null> {
    const cacheKey = this.cacheKey('diff', dir, fileName, revisionIndex);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${dir}/diff_cache/${fileName}/${revisionIndex}.diff`);
      if (!response.ok) return null;
      
      const diff = await response.text();
      this.cache.set(cacheKey, diff);
      return diff;
    } catch (error) {
      console.error(`Failed to fetch diff for ${fileName} at revision ${revisionIndex}:`, error);
      return null;
    }
  }

  // Fetch full file content at specific revision
  async getFileContent(fileName: string, dir: string, revisionIndex: number): Promise<string> {
    const cacheKey = this.cacheKey('content', dir, fileName, revisionIndex);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${dir}/diff_cache/${fileName}/${revisionIndex}.txt`);
      if (!response.ok) return '';
      
      const content = await response.text();
      this.cache.set(cacheKey, content);
      return content;
    } catch (error) {
      console.error(`Failed to fetch content for ${fileName} at revision ${revisionIndex}:`, error);
      return '';
    }
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Fetch list of all posts
  async getPostList(): Promise<string[]> {
    const cacheKey = this.cacheKey('post-list');
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('posts.json');
      const posts: string[] = await response.json();
      this.cache.set(cacheKey, posts);
      return posts;
    } catch (error) {
      console.error('Failed to fetch post list:', error);
      // Fallback: try to get latest post only
      try {
        const latest = await this.getLatestPost();
        return [latest];
      } catch {
        return [];
      }
    }
  }

  // Get adjacent posts for navigation
  async getAdjacentPosts(currentPath: string): Promise<AdjacentPosts> {
    const posts = await this.getPostList();
    const currentIndex = posts.indexOf(currentPath);
    
    if (currentIndex === -1) {
      return { prev: null, next: null };
    }

    return {
      prev: currentIndex > 0 ? posts[currentIndex - 1] : null,
      next: currentIndex < posts.length - 1 ? posts[currentIndex + 1] : null
    };
  }
}