import type { Pr } from '../types';

export interface GitlabIssue {
  iid: number;

  labels?: string[];

  title: string;
}

export interface GitlabComment {
  body: string;
  id: number;
}

export interface GitLabUser {
  id: number;
  username: string;
}

export interface GitLabMergeRequest {
  iid: number;
  title: string;
  state: string;
  source_branch: string;
  target_branch: string;
  description: string;
  diverged_commits_count: number;
  merge_status: string;
  assignee?: GitLabUser;
  assignees?: GitLabUser[];
  reviewers?: GitLabUser[];
  labels: string[];
  sha: string;
  head_pipeline?: {
    status: string;
  };
}

export interface GitlabPr extends Pr {
  headPipelineStatus?: string;
}

export interface UpdateMergeRequest {
  target_branch?: string;
  title?: string;
  assignee_id?: number;
  assignee_ids?: number[];
  reviewer_ids?: number[];
}

export type MergeMethod = 'merge' | 'rebase_merge' | 'ff';

export interface RepoResponse {
  id: number;
  archived: boolean;
  mirror: boolean;
  default_branch: string;
  empty_repo: boolean;
  ssh_url_to_repo: string;
  http_url_to_repo: string;
  forked_from_project: boolean;
  repository_access_level: 'disabled' | 'private' | 'enabled';
  merge_requests_access_level: 'disabled' | 'private' | 'enabled';
  merge_method: MergeMethod;
  path_with_namespace: string;
  squash_option?: 'never' | 'always' | 'default_on' | 'default_off';
}

// See https://gitlab.com/gitlab-org/gitlab/-/blob/master/app/graphql/types/user_status_type.rb
export interface GitlabUserStatus {
  message?: string;
  message_html?: string;
  emoji?: string;
  availability: 'not_set' | 'busy';
}
