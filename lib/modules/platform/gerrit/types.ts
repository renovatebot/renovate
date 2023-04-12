import type { FindPRConfig } from '../types';

export interface GerritProjectInfo {
  id: string;
  name: string;
  parent?: string;
  description?: string;
  state?: 'ACTIVE' | 'READ_ONLY' | 'HIDDEN';
  branches?: Record<string, string>; //TODO: always empty???
  labels?: Record<string, GerritLabelTypeInfo>;
  web_links?: unknown[];
}

export interface GerritLabelTypeInfo {
  values: Record<number, string>;
  default_value: number;
}

export interface GerritBranchInfo {
  ref: string;
  revision: string;
}

export interface GerritFindPRConfig extends FindPRConfig {
  targetBranch?: string;
  label?: string;
}

export type GerritChangeStatus = 'NEW' | 'MERGED' | 'ABANDONED';

export type GerritReviewersType = 'REVIEWER' | 'CC' | 'REMOVED';

export interface GerritChange {
  id: string;
  project: string;
  branch: string;
  topic?: string;
  attention_set?: GerritAttentionSetInfo[];
  removed_from_attention_set?: GerritAttentionSetInfo[];
  assignee?: GerritAccountInfo;
  hashtags?: string[];
  change_id: string;
  subject: string;
  status: GerritChangeStatus;
  created: string;
  updated: string;
  submitted?: string;
  submitter?: GerritAccountInfo;
  starred?: boolean;
  stars?: string[];
  reviewed?: boolean;
  submit_type?:
    | 'Inherit'
    | 'Fast Forward Only'
    | 'Merge If Necessary'
    | 'Always Merge'
    | 'Cherry Pick'
    | 'Rebase If Necessary'
    | 'Rebase Always';
  mergeable?: boolean;
  submittable?: boolean;
  insertions: number;
  deletions: number;
  total_comment_count?: number;
  unresolved_comment_count?: number;
  _number: number;
  owner: GerritAccountInfo;
  actions?: Record<string, GerritActionInfo>;
  submit_records: unknown[];
  requirements?: unknown[];
  submit_requirements?: unknown[];
  labels?: Record<string, GerritLabelInfo>;
  permitted_labels?: unknown[];
  removable_reviewers?: unknown[];
  reviewers?: Record<GerritReviewersType, GerritAccountInfo[]>;
  pending_reviewers?: unknown;
  reviewer_updates?: unknown;
  messages?: GerritChangeMessageInfo[];
  current_revision?: string;
  /**
   * All patch sets of this change as a map that maps the commit ID of the patch set to a RevisionInfo entity.
   */
  revisions?: Record<string, GerritRevisionInfo>;
  meta_rev_id?: string;
  tracking_ids?: unknown;
  _more_changes?: unknown;
  problems: unknown[];
  is_private?: boolean;
  work_in_progress?: boolean;
  has_review_started?: boolean;
  revert_of?: string;
  submission_id?: string;
  cherry_pick_of_change?: string;
  cherry_pick_of_patch_set?: string;
  contains_git_conflicts?: string;
}

export interface GerritRevisionInfo {
  /**
   * The change kind.
   * Valid values are: REWORK, TRIVIAL_REBASE, MERGE_FIRST_PARENT_UPDATE, NO_CODE_CHANGE, and NO_CHANGE. */
  kind: string;
  /**
   * The patch set number, or edit if the patch set is an edit.
   */
  _number: string;
  created: string;
  uploader: GerritAccountInfo;
  /**
   * The Git reference for the patch set.
   */
  ref: string;
  actions?: Record<string, GerritActionInfo>;
}

export interface GerritChangeMessageInfo {
  id: string;
  author?: GerritAccountInfo;
  real_author?: GerritAccountInfo;
  date: string;
  message: string;
  accountsInMessage: GerritAccountInfo[];
  tag?: string;
  _revision_number?: number;
}

export interface GerritLabelInfo {
  optional?: boolean;
  description?: string;
  approved?: GerritAccountInfo;
  rejected?: GerritAccountInfo;
  recommended?: GerritAccountInfo;
  disliked?: GerritAccountInfo;
  blocking?: boolean;
  /**
   * The voting value of the user who recommended/disliked this label on the change if it is not “+1”/“-1”.
   */
  value?: string;
  default_value?: string;
  /**
   * A list of integers containing the vote values applied to this label at the latest patchset.
   */
  votes?: number[];
  all?: unknown[];
  /**
   * A map of all values that are allowed for this label. The map maps the values (“-2”, “-1”, " `0`", “+1”, “+2”) to the value descriptions.
   */
  values?: unknown;
}

export interface GerritActionInfo {
  method?: string;
  label?: string;
  title?: string;
  enabled?: boolean;
}

export interface GerritAccountInfo {
  _account_id: number;
  name?: string;
  display_name?: string;
  email?: string;
  secondary_emails?: string[];
  username?: string;
  avatars?: unknown;
  _more_accounts?: boolean;
  status?: string;
  inactive?: boolean;
  tags?: string[];
}

export interface GerritAttentionSetInfo {
  account: GerritAccountInfo;
  last_update: string;
  reason: string;
  reason_account: GerritAccountInfo;
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
