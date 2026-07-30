import type { GitPullRequestMergeStrategy } from 'azure-devops-node-api/interfaces/GitInterfaces.js';
import type { Pr } from '../types.ts';

export interface AzurePr extends Pr {
  sourceRefName?: string;
}

export const AzurePrVote = {
  NoVote: 0,
  Reject: -10,
  WaitingForAuthor: -5,
  ApprovedWithSuggestions: 5,
  Approved: 10,
} as const;

export interface Config {
  repoForceRebase: boolean;
  mergeMethods: Record<string, GitPullRequestMergeStrategy>;
  owner: string;
  repoId: string;
  project: string;
  projectId: string;
  prList: AzurePr[];
  fileList: null;
  repository: string;
  defaultBranch: string;
  /** Work item type for issues; from `azureWorkItemType`, defaults to `Issue`. */
  workItemType: string;
}
