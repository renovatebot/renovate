import type { FindPRConfig } from '../types';

export const TAG_PULL_REQUEST_BODY = 'pull-request';

export interface GerritProjectInfo {
  id: string;
  name: string;
  parent?: string;
  description?: string;
  state?: 'ACTIVE' | 'READ_ONLY' | 'HIDDEN';
  branches?: { [key: string]: string }; //TODO: always empty???
  labels?: { [key: string]: GerritLabelInfo };
  web_links?: any;
}

export interface GerritBranchInfo {
  ref: string;
  revision: string;
}

export interface GerritFindPRConfig extends FindPRConfig {
  targetBranch?: string;
  hashtag?: string;
  label?: string;
}

export type GerritChangeStatus = 'NEW' | 'MERGED' | 'ABANDONED';

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
  submitted?: Date; //TODO: convert
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
  actions?: GerritActionInfo[];
  submit_records: any[]; // SubmitRecordInfo[]
  requirements?: any[]; //List of the requirements
  submit_requirements?: any[]; //List of the SubmitRequirementResultInfo
  labels?: { [key: string]: GerritLabelInfo };
  permitted_labels?: any[];
  removable_reviewers?: any[];
  reviewers?: { [key: string]: GerritAccountInfo[] }; //key = ReviewerState
  pending_reviewers?: any;
  reviewer_updates?: any;
  messages?: GerritChangeMessageInfo[];
  current_revision?: string;
  revisions?: { [key: string]: GerritRevisionInfo }; //All patch sets of this change as a map that maps the commit ID of the patch set to a RevisionInfo entity.
  meta_rev_id?: string;
  tracking_ids?: any;
  _more_changes?: any;
  problems: any[];
  is_private?: boolean;
  work_in_progress?: boolean;
  has_review_started?: boolean;
  revert_of?: string;
  submission_id?: string;
  cherry_pick_of_change?: string;
  cherry_pick_of_patch_set?: string;
  contains_git_conflicts?: string;
}

//type ReviewerState = "REVIEWER"|"CC"|"REMOVED";
export interface GerritRevisionInfo {
  kind: string; //The change kind. Valid values are REWORK, TRIVIAL_REBASE, MERGE_FIRST_PARENT_UPDATE, NO_CODE_CHANGE, and NO_CHANGE.
  _number: string; //The patch set number, or edit if the patch set is an edit.
  created: Date; //TODO: map
  uploader: GerritAccountInfo;
  ref: string; //The Git reference for the patch set.
  //... many more...still not necessary
}

export interface GerritChangeMessageInfo {
  id: string;
  author?: GerritAccountInfo;
  real_author?: GerritAccountInfo;
  date: Date; //TODO: convert
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
  value?: string; //The voting value of the user who recommended/disliked this label on the change if it is not “+1”/“-1”.
  default_value?: string;
  votes?: number[]; //A list of integers containing the vote values applied to this label at the latest patchset.
  all?: any[];
  values?: any; //A map of all values that are allowed for this label. The map maps the values (“-2”, “-1”, " `0`", “+1”, “+2”) to the value descriptions.
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
  avatars?: any;
  _more_accounts?: boolean;
  status?: string;
  inactive?: boolean;
  tags?: string[];
}

export interface GerritAttentionSetInfo {
  account: GerritAccountInfo;
  last_update: Date;
  reason: string;
  reason_account: GerritAccountInfo;
}
