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
