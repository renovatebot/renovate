import type { FindPRConfig } from '../types.ts';
import type { GerritChange } from './schema.ts';

export interface GerritFindPRConfig extends FindPRConfig {
  label?: string;
  requestDetails?: GerritRequestDetail[];
  /**
   * Whether only one change is needed.
   * Useful for optimizing the search request.
   */
  singleChange?: boolean;
  /**
   * How many changes to fetch per request/page.
   * Default is 50.
   * Useful when handling pagination manually.
   */
  pageLimit?: number;
  /**
   * Predicate function to determine if the next page should be fetched.
   * Called after each page is fetched with the changes from that page.
   * Return false to stop fetching more pages, true to continue.
   * Useful for early termination when using cache reconciliation.
   */
  shouldFetchNextPage?: (changes: GerritChange[]) => boolean;
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
