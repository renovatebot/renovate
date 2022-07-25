export interface BitbucketTag {
  name: string;
  target?: {
    date?: string;
    hash: string;
  };
}

export interface BitbucketCommit {
  hash: string;
  date?: string;
}
