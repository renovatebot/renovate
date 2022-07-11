import type { GitTreeNode } from '../../git';

export type GitLabBranch = {
  default: boolean;
  name: string;
};

/**
 * https://docs.gitlab.com/13.2/ee/api/repositories.html#list-repository-tree
 */
export type GitlabTreeNode = {
  id: string;
  name: string;
} & GitTreeNode;
