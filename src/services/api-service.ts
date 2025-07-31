import type { RevisionInfo, FileRevisions } from '../types/index.js';

export class ApiService {
  private static instance: ApiService;
  private cache: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  // Fetch latest post path
  async getLatestPost(): Promise<string> {
    const cacheKey = 'latest';
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch('latest.json');
      const basePath: string = await response.json();
      this.cache.set(cacheKey, basePath);
      return basePath;
    } catch (error) {
      console.error('Failed to fetch latest post:', error);
      throw error;
    }
  }

  // Fetch post HTML content
  async getPostContent(basePath: string): Promise<string> {
    const cacheKey = `post-${basePath}`;
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
    const cacheKey = `revisions-${dir}-${fileName}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const response = await fetch(`${dir}/diff_cache/${fileName}/revisions.json`);
      const revisions: RevisionInfo[] = await response.json();
      this.cache.set(cacheKey, revisions);
      return revisions;
    } catch (error) {
      console.error(`Failed to fetch revisions for ${fileName}:`, error);
      return [];
    }
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
  async getMergedRevisions(basePath: string): Promise<{ date: string; files: Map<string, any> }[]> {
    const files = await this.getAllFileRevisions(basePath);
    const allRevisions = new Map<string, { date: string; files: Map<string, any> }>();

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
    const cacheKey = `diff-${dir}-${fileName}-${revisionIndex}`;
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
    const cacheKey = `content-${dir}-${fileName}-${revisionIndex}`;
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
}