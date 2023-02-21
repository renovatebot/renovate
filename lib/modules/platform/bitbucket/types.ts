import type { JSONDocNode } from '@atlaskit/editor-json-transformer';

export type BitbucketMergeStrategy = 'fast_forward' | 'merge_commit' | 'squash';

export interface MergeRequestBody {
  close_source_branch?: boolean;
  message?: string;
  merge_strategy?: BitbucketMergeStrategy;
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
    description: JSONDocNode;
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
