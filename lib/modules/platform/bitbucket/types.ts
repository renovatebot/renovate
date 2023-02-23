import type { Pr } from '../types';

export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface Config {
  defaultBranch: string;
  hasBitbucketIssuesEnabled: boolean;
  mergeMethod: string;
  owner: string;
  prList: Pr[];
  repository: string;
  username: string;
  userUuid: string;
  ignorePrAuthor: boolean;
  repositoryUrl: string;
  hasJiraProjectLinked: boolean;
  jiraProjectKey: string;
  jiraCloudUrl: string;
}

export interface PagedResult<T = any> {
  pagelen: number;
  size?: number;
  next?: string;
  values: T[];
}

export interface RepoInfo {
  isFork: boolean;
  owner: string;
  mainbranch: string;
  mergeMethod: string;
  has_issues: boolean;
  uuid: string;
  repositoryUrl: string;
}

export type BitbucketBranchState = 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS';
export interface BitbucketStatus {
  key: string;
  state: BitbucketBranchState;
}

export interface RepoInfoBody {
  parent?: any;
  owner: { username: string };
  mainbranch: { name: string };
  has_issues: boolean;
  uuid: string;
  links: { html: { href: string } };
}

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
}

export interface PrResponse {
  id: number;
  title: string;
  state: string;
  links: {
    commits: {
      href: string;
    };
  };
  summary?: { raw: string };
  source: {
    branch: {
      name: string;
    };
  };
  destination: {
    branch: {
      name: string;
    };
  };
  reviewers: Array<Account>;
  created_on: string;
}

export interface BranchResponse {
  target: {
    hash: string;
  };
}
export interface Account {
  display_name?: string;
  uuid: string;
  nickname?: string;
  account_status?: string;
}

export interface EffectiveReviewer {
  type: string;
  reviewer_type: string;
  user: Account;
}

export interface BitbucketIssue {
  id: number;
  title: string;
  content?: {
    raw: string;
  };
}

export interface JiraProjectsResponse {
  values: JiraProject[];
}

export interface JiraProject {
  project: {
    id: number;
    cloudId: string;
    key: string;
    name: string;
    url: string;
    site: {
      cloudId: string;
      cloudName: string;
      cloudUrl: string;
    };
  };
}

export interface JiraSearchResponse {
  issues: JiraIssue[];
}

export interface JiraIssue {
  id: number;
  key: string;
  fields: {
    description: AtlassianDocumentFormat;
    summary: string;
  };
}

export interface JiraTransitionsResponse {
  transitions: JiraTransition[];
}

export const StatusCategoryKey = [
  'new',
  'indeterminate',
  'in-progress',
  'done',
] as const;

export interface JiraTransition {
  id: number;
  name: string;
  to: {
    statusCategory: {
      key: string; // TODO Add types
    };
  };
}

export interface AtlassianDocumentFormat {
  type: string;
  version: number;
  content?: AtlassianDocumentContent[];
}

export interface AtlassianDocumentContent {
  type?: string;
  text?: string;
  attrs?: AtlassianDocumentAttributes;
  marks?: AtlassianDocumentMarks[];
  content?: AtlassianDocumentContent[];
}

export interface AtlassianDocumentMarks {
  type: string;
  attrs?: AtlassianDocumentAttributes;
}

export interface AtlassianDocumentAttributes {
  href?: string;
  level?: number;
}

export interface MarkdownASTNode {
  type: string;
  value: string;
  children: MarkdownASTNode[];
  url?: string;
  depth?: number;
  ordered?: boolean;
}
