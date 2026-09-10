import type { Pr, RepoSortMethod, SortMethod } from '../types.ts';
import type {
  CommitStatus,
  CommitStatusType,
  IssueState,
  PRMergeMethod,
  PRState,
} from './schema.ts';

export interface PrReviewersParams {
  reviewers?: string[];
  team_reviewers?: string[];
}

export interface CombinedCommitStatus {
  worstStatus: CommitStatusType;
  statuses: CommitStatus[];
}

export interface RepoSearchParams {
  uid?: number;
  archived?: boolean;
  topic?: boolean;
  q?: string;

  /**
   * Repo sort type, defaults to `alpha`.
   */
  sort?: RepoSortMethod;

  /**
   * Repo sort order, defaults to `asc`
   */
  order?: SortMethod;
}

export type IssueCreateParams = Partial<IssueUpdateLabelsParams> &
  IssueUpdateParams;

export interface IssueUpdateParams {
  title?: string;
  body?: string;
  state?: IssueState;
  assignees?: string[];
}

export interface IssueUpdateLabelsParams {
  labels?: number[];
}

export interface IssueSearchParams {
  state?: IssueState;
}

export interface PRCreateParams extends PRUpdateParams {
  head?: string;
}

export interface PRUpdateParams {
  title?: string;
  body?: string;
  assignees?: string[];
  labels?: number[];
  state?: PRState;
  base?: string;
}

export interface PRMergeParams {
  Do: PRMergeMethod;
  merge_when_checks_succeed?: boolean;
  delete_branch_after_merge?: boolean;
}

export type CommentCreateParams = CommentUpdateParams;

export interface CommentUpdateParams {
  body: string;
}

export interface CommitStatusCreateParams {
  context?: string;
  description?: string;
  state?: CommitStatusType;
  target_url?: string;
}

export interface ForgejoPrCacheData {
  items: Record<number, Pr>;
  updated_at: string | null;
  author: string | null;
}
