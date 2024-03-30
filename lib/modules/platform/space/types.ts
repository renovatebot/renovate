export interface SpacePaginatedResult {

}

export interface SpaceRepositoryBasicInfo {
  projectKey: string;
  repository: string;
}

export interface SpaceRepositoryDetails {
  id?: string;
  name: string;
  description: string;
  latestActivity?: Date;
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
  // issueIds: Array<string>;
}

export interface SpaceMergeRequestBranchPair {
  repositoryId?: string;
  // repository: string;
  sourceBranch: string;
  targetBranch: string;
  // sourceBranchRef: string;
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

export interface SpaceChannelItem {
  id: string
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
  archive: boolean;
}

export interface SpaceJobExecutionDTO {
  executionId: string;
  executionNumber: number;
  jobId: string;
  branch: string;
  status: SpaceExecutionStatus;
  commitId?: string;
}

export interface SpaceBranchHead {
  head: string;
  ref: string;
}

export type SpaceExecutionStatus =
  'SCHEDULED'
  | 'PENDING'
  | 'READY_TO_START'
  | 'RUNNING'
  | 'FINISHING'
  | 'FINISHED'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'HIBERNATING'
  | 'HIBERNATED'
  | 'RESTARTING'
  | 'FAILED'
  | 'SKIPPED';

export interface SpaceFileContent {
  type: 'TEXT' | 'LARGE' | 'LINK' | 'IMAGE' | 'BINARY_OTHER';
  // lineEnding?: 'CR' | 'LF' | 'CRLF';
  // bom?: {
  //   name: string
  // };
  lines: Array<CodeLine>;
  // widgets?: Array<CodeMDWidget>;
  // folds?: Array<CodeFold>;
  // scopes?: Array<CodeScopeRange>;
}

export interface CodeLine {
  text: string;
  // index?: number;
  // offset: number;
  // syntax?: Array<SyntaxMarkup>;
}

export type SpaceCodeReviewParticipantRole = 'Reviewer' | 'Author' | 'Watcher';

