export type GitlabTag = {
  name: string;
  commit?: {
    created_at?: string;
  };
};

export type GitlabCommit = {
  id: string;
};
