export interface GitlabTag {
  name: string;
  commit?: {
    created_at?: string;
  };
}

export interface GitlabCommit {
  id: string;
}
