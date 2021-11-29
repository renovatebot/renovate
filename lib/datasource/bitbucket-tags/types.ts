export type BitbucketTag = {
  name: string;
  target?: {
    date?: string;
    hash: string;
  };
};

export type BitbucketCommit = {
  hash: string;
  date?: string;
};
