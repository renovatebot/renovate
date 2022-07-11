import type { GitTreeNode } from '../../git';

export type GithubGitBase = {
  sha: string;
  url: string;
  size: number;
};

/**
 * https://docs.github.com/en/rest/reference/git#get-a-tree
 */
export type GithubGitTreeNode = GithubGitBase & GitTreeNode;

export type GithubGitTree = {
  sha: string;
  url: string;
  tree: GithubGitTreeNode[];
  truncated: boolean;
};

/**
 * https://docs.github.com/en/rest/reference/git#get-a-blob
 */
export type GithubGitBlob = {
  type: string;
  content: string;
  encoding: string;
} & GithubGitBase;
