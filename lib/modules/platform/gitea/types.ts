import type { GiteaHttpOptions } from '../../../util/http/gitea.ts';
import type { HttpBase } from '../../../util/http/http.ts';
import type { Platform, Pr, RepoSortMethod, SortMethod } from '../types.ts';
import type {
  CommitStatus,
  CommitStatusType,
  IssueState,
  PRMergeMethod,
  PRState,
} from './schema.ts';

/**
 * Id of a platform that speaks the Gitea API. Doubles as the key both platforms
 * use for their repository cache and memory cache entries.
 */
export type GiteaPlatformKey = 'gitea' | 'forgejo';

/**
 * Http client of a platform which speaks the Gitea API. Typed as the base class
 * so that both `GiteaHttp` and `ForgejoHttp` are accepted.
 */
export type GiteaLikeHttp = HttpBase<GiteaHttpOptions>;

export interface GiteaPlatformOptions {
  /** Platform id, also used as `hostType` and as cache key. */
  id: GiteaPlatformKey;

  /** Endpoint used when the user did not configure one. */
  defaultEndpoint: string;

  /** Http client bound to this platform's `hostType`. */
  http: GiteaLikeHttp;

  /** Sets the base url of the module-level http client. */
  setBaseUrl: (baseUrl: string) => void;

  /** Logs the instance version detected during `initPlatform()`. */
  logDetectedVersion: (version: string) => void;

  /**
   * Returns `null` when the instance supports native automerge, otherwise the
   * message explaining why it does not.
   */
  checkNativeAutomerge: (version: string) => string | null;

  /**
   * Lowest instance version which supports requesting reviewers.
   * Leave unset when every supported version does.
   */
  minReviewerVersion?: string;
}

export interface GiteaPlatform {
  platform: Platform;
  resetPlatform: () => void;
}

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

export interface PrCacheData {
  items: Record<number, Pr>;
  updated_at: string | null;
  author: string | null;
}
