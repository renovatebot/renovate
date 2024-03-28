import type {FindPRConfig} from '../types';

export interface GerritFindPRConfig extends FindPRConfig {
  label?: string;
}

/**
 * The Interfaces for the Gerrit API Responses ({@link https://gerrit-review.googlesource.com/Documentation/rest-api.html | REST-API})
 * minimized to only needed properties.
 *
 * @packageDocumentation
 */

export interface SpacePaginatedResult<T> {
  next: string;
  totalCount?: number;
  data: T[];
}

export interface SpaceRepositoryBasicInfo {
  projectKey: string;
  repository: string;
  starred: boolean;
}

export interface SpaceProject {
  id: string;
  key: SpaceProjectKey;
  name: string;
  _private: boolean;
  description?: string;
  icon?: string;
  latestRepositoryActivity?: Date;
  createdAt?: Date;
  archived: boolean;
}

export interface SpaceProjectKey {
  key: string;
}

export interface SpaceRepositoryDetails {
  id?: string;
  name: string;
  description: string;
  latestActivity?: Date;
  proxyPushNotification?: Date;
  proxyPushNotificationBody?: string;
  initProgress?: string;
  readmeName?: string;
  defaultBranch?: {
    head: string;
    ref: string;
  };
}

export type CodeReviewStateFilter = 'Opened' | 'Closed' | 'RequiresAuthorAttention' | 'NeedsReview' | 'Merged' | 'null';

export interface SpaceCodeReviewBasicInfo {
  review: {
    className: CodeReviewClassName,
    id: string
  },
  messagesCount: number
}

export type CodeReviewClassName = 'MergeRequestRecord' | 'CommitSetReviewRecord'

export interface SpaceMergeRequestRecord {
  id: string;
  project: SpaceProjectKey;
  projectId: string;
  number: number;
  title: string;
  state: SpaceCodeReviewState;
  canBeReopened?: boolean;
  branchPairs: Array<SpaceMergeRequestBranchPair>;
  createdAt: number;
  timestamp?: number;
  turnBased?: boolean;
  feedChannelId?: string;
  readOnly?: boolean;
  description?: string;
  issueIds: Array<string>;
}

export interface SpaceMergeRequestBranchPair {
  repositoryId?: string;
  repository: string;
  sourceBranch: string;
  targetBranch: string;
  sourceBranchRef: string;
  isMerged?: boolean;
  isStale?: boolean;
}

export type SpaceCodeReviewState = 'Opened' | 'Closed' | 'Deleted';


export interface SpaceCodeReviewCreateRequest {
  repository: string;
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description?: string;
  // reviewers?: Array<ReviewerParam>;
}

export interface SpaceChannelMessagesList {
  messages: [{
    id: string;
  }]
}

export interface SpaceChannelItemRecord {
  text: string;
  details?: SpaceReviewCreatedEvent;
  // author: CPrincipal;
  created: Date;
  time: number;
  // reactions?: AllReactionsToItemRecord;
  // thread?: M2ChannelRecord;
  // projectedItem?: ChannelItemRecord;
  // attachments?: Array<AttachmentInfo>;
  externalId?: string;
  pending?: boolean;
  id: string;
  archived: boolean;
  edited?: Date;
  pinned?: boolean;
  // suggestedParticipants?: Array<CPrincipal>;
  // mentions?: Array<EntityMention>;
  channelId?: string;
  importerAppId?: string;
  // issues: Array<Issue>;
  // externalIssues?: Array<ExternalIssue>;
}

export interface SpaceReviewCreatedEvent {
  projectKey: string;
  reviewId: string;
  reviewNumber: number;
  // reviewType: ReviewType;
  description?: {
    text: string;
  };
  // descriptionEditedByProfileIds: Array<TDMemberProfile>;
  // commits?: Array<UnfurlDetailsCommit>;
}

export interface SpaceJobDTO {
  id: string;
  name: string;
  repoName: string;
  repository: {
    name: string;
    isDeleted: boolean;
  };
  archive: boolean;
}

export interface SpaceJobExecutionDTO {
  executionId: string;
  executionNumber: number;
  jobId: string;
  jobName: string;
  projectId: string;
  branch: string;
  status: SpaceExecutionStatus;
  triggeredTime: number;
  startedTime?: number;
  finishedTime?: number;
  changesCount: number;
  // failureConditions: Array<FailureConditionDTO>;
  commitId?: string;
}

export interface SpaceBranchInfo {
  head: string;
  ref: string;
}

export type SpaceExecutionStatus = 'SCHEDULED' | 'PENDING' | 'READY_TO_START' | 'RUNNING' | 'FINISHING' | 'FINISHED' | 'TERMINATING' | 'TERMINATED' | 'HIBERNATING' | 'HIBERNATED' | 'RESTARTING' | 'FAILED' | 'SKIPPED';


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
  hashtags?: string[];
  change_id: string;
  subject: string;
  status: GerritChangeStatus;
  submittable?: boolean;
  _number: number;
  labels?: Record<string, GerritLabelInfo>;
  reviewers?: Record<GerritReviewersType, GerritAccountInfo[]>;
  messages?: GerritChangeMessageInfo[];
  current_revision?: string;
  /**
   * All patch sets of this change as a map that maps the commit ID of the patch set to a RevisionInfo entity.
   */
  revisions?: Record<string, GerritRevisionInfo>;
  problems: unknown[];
}

export interface GerritRevisionInfo {
  uploader: GerritAccountInfo;
  /**
   * The Git reference for the patch set.
   */
  ref: string;
  actions?: Record<string, GerritActionInfo>;
}

export interface GerritChangeMessageInfo {
  id: string;
  message: string;
  tag?: string;
}

export interface GerritLabelInfo {
  approved?: GerritAccountInfo;
  rejected?: GerritAccountInfo;
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
