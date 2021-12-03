export interface TagResponse {
  object: {
    type: string;
    url: string;
    sha: string;
  };
}

export interface GitHubTag {
  name: string;
}
