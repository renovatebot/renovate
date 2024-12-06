import type { FindPRConfig } from '../types';

export interface GerritFindPRConfig extends FindPRConfig {
  label?: string;
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

export type GerritReviewersType = 'REVIEWER' | 'CC' | 'REMOVED';

export interface GerritChange {
  branch: string;
  /**
   * for backwards compatibility
   */
  hashtags?: string[];
  change_id: string;
  subject: string;
  status: GerritChangeStatus;
  submittable?: boolean;
  _number: number;
  labels?: Record<string, GerritLabelInfo>;
  reviewers?: Record<GerritReviewersType, GerritAccountInfo[]>;
  messages?: GerritChangeMessageInfo[];
  current_revision: string;
  /**
   * All patch sets of this change as a map that maps the commit ID of the patch set to a RevisionInfo entity.
   */
  revisions: Record<string, GerritRevisionInfo>;
  problems: unknown[];
}

export interface GerritCommitInfo {
  message: string;
}

export interface GerritRevisionInfo {
  uploader: GerritAccountInfo;
  /**
   * The Git reference for the patch set.
   */
  ref: string;
  actions?: Record<string, GerritActionInfo>;
  commit: GerritCommitInfo;
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
