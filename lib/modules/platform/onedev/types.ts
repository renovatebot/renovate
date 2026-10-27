/**
 * Merge strategies supported by OneDev pull requests.
 */
export type PullRequestMergeStrategy =
  | 'CREATE_MERGE_COMMIT'
  | 'CREATE_MERGE_COMMIT_IF_NECESSARY'
  | 'SQUASH_SOURCE_BRANCH_COMMITS'
  | 'REBASE_SOURCE_BRANCH_COMMITS';

export interface PullRequestCreateParams {
  targetProjectId: number;
  sourceProjectId: number;
  targetBranch: string;
  sourceBranch: string;
  title: string;
  description: string;
  workInProgress?: boolean;
  mergeStrategy?: PullRequestMergeStrategy;
  reviewerIds?: number[];
  assigneeIds?: number[];
}

export interface AutoMergeParams {
  commitMessage: string;
  enabled: boolean;
}

export interface IssueCreateParams {
  projectId: number;
  title: string;
  description: string;
  confidential?: boolean;
}

export interface IssueStateTransitionParams {
  state: string;
  comment?: string;
}

export interface PullRequestCommentCreateParams {
  requestId: number;
  userId: number;
  content: string;
}

/**
 * HTTP Basic auth credentials used for every OneDev API and git request.
 */
export interface OneDevCredentials {
  username: string;
  password: string;
}
