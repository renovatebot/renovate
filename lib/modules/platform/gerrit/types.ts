import type { FindPRConfig } from '../types';

export interface GerritFindPRConfig extends FindPRConfig {
  label?: string;
  limit?: number;
  requestDetails?: GerritRequestDetail[];
}

/**
 * The Interfaces for the Gerrit API Responses ({@link https://gerrit-review.googlesource.com/Documentation/rest-api.html | REST-API})
 * minimized to only needed properties.
 *
 * @packageDocumentation
 */

export interface GerritProjectInfo {
  id: string;
  name: string;
  state?: 'ACTIVE' | 'READ_ONLY' | 'HIDDEN';
  labels?: Record<string, GerritLabelTypeInfo>;
}

export interface GerritLabelTypeInfo {
  values: Record<number, string>;
  default_value: number;
}

export interface GerritBranchInfo {
  ref: string;
  revision: string;
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

export interface GerritChange {
  branch: string;
  change_id: string;
  subject: string;
  status: GerritChangeStatus;
  created: string;
  hashtags: string[];
  /** Requires o=SUBMITTABLE. */
  submittable?: boolean;
  _number: number;
  /** Requires o=LABELS. */
  labels?: Record<string, GerritLabelInfo>;
  /** Requires o=LABELS. */
  reviewers?: {
    REVIEWER?: GerritAccountInfo[];
  };
  /** Requires o=MESSAGES. */
  messages?: GerritChangeMessageInfo[];
  /** Requires o=CURRENT_REVISION. */
  current_revision?: string;
  /**
   * All patch sets of this change as a map that maps the commit ID of the patch set to a RevisionInfo entity.
   * Requires o=CURRENT_REVISION.
   */
  revisions?: Record<string, GerritRevisionInfo>;
  /**
   * Potential consistency issues with the change (not related to labels).
   * Requires o=CHECKS. */
  problems?: unknown[];
}

export interface GerritRevisionInfo {
  uploader: GerritAccountInfo;
  /** The Git reference for the patch set. */
  ref: string;
  /** Requires o=CURRENT_ACTIONS. */
  actions?: Record<string, GerritActionInfo>;
  /** Requires o=COMMIT_FOOTERS. */
  commit_with_footers?: string;
}

export interface GerritChangeMessageInfo {
  id: string;
  message: string;
  tag?: string;
}

export interface GerritLabelInfo {
  approved?: GerritAccountInfo;
  rejected?: GerritAccountInfo;
  /** If true, the label blocks submit operation. If not set, the default is false. */
  blocking?: boolean;
}

export interface GerritActionInfo {
  method?: string;
  enabled?: boolean;
}

export interface GerritAccountInfo {
  _account_id: number;
  /** Requires o=DETAILED_ACCOUNTS. */
  username?: string;
}

export interface GerritMergeableInfo {
  submit_type:
    | 'MERGE_IF_NECESSARY'
    | 'FAST_FORWARD_ONLY'
    | 'REBASE_IF_NECESSARY'
    | 'REBASE_ALWAYS'
    | 'MERGE_ALWAYS'
    | 'CHERRY_PICK';
  mergeable: boolean;
}
