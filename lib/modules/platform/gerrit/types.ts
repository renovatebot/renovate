import type { FindPRConfig } from '../types.ts';

export interface GerritFindPRConfig extends FindPRConfig {
  label?: string;
  requestDetails?: GerritRequestDetail[];
  /**
   * Whether only one change is needed.
   * Useful for optimizing the search request.
   */
  singleChange?: boolean;
  /**
   * Whether to disable the automatic pagination handling or not.
   * Useful when handling pagination manually.
   */
  noPagination?: boolean;
  /**
   * How many changes to fetch per request/page.
   * Default is 50.
   * Useful when handling pagination manually.
   */
  pageLimit?: number;
  /**
   * How many changes to skip from the beginning.
   * Default is 0.
   * Useful when handling pagination manually.
   */
  startOffset?: number;
}

export type GerritChangeStatus = 'NEW' | 'MERGED' | 'ABANDONED';

export type GerritRequestDetail =
  | 'SUBMITTABLE'
  | 'CHECK'
  | 'MESSAGES'
  | 'DETAILED_ACCOUNTS'
  | 'LABELS'
  | 'CURRENT_ACTIONS'
  | 'CURRENT_REVISION'
  | 'COMMIT_FOOTERS';

export interface GerritHashtagsInput {
  add?: string[] | null;
  remove?: string[] | null;
}
