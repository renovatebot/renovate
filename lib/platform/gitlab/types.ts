export interface GitlabIssue {
  iid: number;
  title: string;
}

export interface GitlabComment {
  body: string;
  id: number;
}

export type MergeMethod = 'merge' | 'rebase_merge' | 'ff';

export type Namespace = {
  path: string;
}

export type RepoResponse = {
  archived: boolean;
  mirror: boolean;
  default_branch: string;
  empty_repo: boolean;
  http_url_to_repo: string;
  forked_from_project: boolean;
  namespace: Namespace;
  repository_access_level: 'disabled' | 'private' | 'enabled';
  merge_requests_access_level: 'disabled' | 'private' | 'enabled';
  merge_method: MergeMethod;
  path_with_namespace: string;
};
