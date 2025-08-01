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

export interface AdjacentPosts {
  prev: string | null;
  next: string | null;
}
