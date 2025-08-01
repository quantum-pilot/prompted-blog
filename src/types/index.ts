export interface PostData {
  path: string;
  title?: string;
}

export interface RevisionInfo {
  hash: string;
  date: string;
}

export interface FileRevisions {
  name: string;
  dir: string;
  list: RevisionInfo[];
}

export interface FileInRevision {
  name: string;
  dir: string;
  revIdx: number;
  hash: string;
}

export interface RevisionData {
  date: string;
  files: Map<string, FileInRevision>;
}

/**
 * Represents the previous and next post paths for navigation
 * Used by blog header navigation and post switching functionality
 */
export interface AdjacentPosts {
  /** Path to the previous post, null if current post is the first */
  prev: string | null;
  /** Path to the next post, null if current post is the last */
  next: string | null;
}

/**
 * Utility functions for working with AdjacentPosts
 */
export const AdjacentPostsUtils = {
  /** Check if there is a previous post available */
  hasPrev: (adjacent: AdjacentPosts): boolean => adjacent.prev !== null,
  
  /** Check if there is a next post available */
  hasNext: (adjacent: AdjacentPosts): boolean => adjacent.next !== null,
  
  /** Check if navigation is available in either direction */
  hasNavigation: (adjacent: AdjacentPosts): boolean => 
    adjacent.prev !== null || adjacent.next !== null,
    
  /** Create an empty AdjacentPosts object */
  empty: (): AdjacentPosts => ({ prev: null, next: null })
} as const;
