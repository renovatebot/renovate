import { PLATFORM_TYPE_GITLAB } from '../../../constants/platforms';
import { GitTreeNode } from '../../git';

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

export const GITLAB_API_USING_HOST_TYPES = [
  PLATFORM_TYPE_GITLAB,
  'gitlab-releases',
  'gitlab-tags',
  'pod',
];
