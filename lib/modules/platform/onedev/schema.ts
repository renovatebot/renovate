import { z } from 'zod/v4';
import { LooseArray, Nullish } from '../../../util/schema-utils/index.ts';

export const User = z.object({
  id: z.number(),
  name: z.string(),
  fullName: Nullish(z.string()),
  email: Nullish(z.string()),
});
export type User = z.infer<typeof User>;

export const UserEmail = z.object({
  id: z.number(),
  value: z.string(),
  primary: z.boolean(),
  ownerId: z.number(),
});
export type UserEmail = z.infer<typeof UserEmail>;
export const UserEmailList = LooseArray(UserEmail);

export const Project = z.object({
  id: z.number(),
  path: z.string(),
  name: Nullish(z.string()),
  description: Nullish(z.string()),
  parentId: Nullish(z.number()),
  forkedFromId: Nullish(z.number()),
  codeManagement: Nullish(z.boolean()),
  issueManagement: Nullish(z.boolean()),
});
export type Project = z.infer<typeof Project>;
export const ProjectList = LooseArray(Project);

export const CloneUrl = z.object({
  http: z.string(),
  ssh: z.string(),
});
export type CloneUrl = z.infer<typeof CloneUrl>;

export const PullRequestStatus = z.enum(['OPEN', 'MERGED', 'DISCARDED']);
export type PullRequestStatus = z.infer<typeof PullRequestStatus>;

export const PullRequest = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  description: Nullish(z.string()),
  sourceProjectId: Nullish(z.number()),
  sourceBranch: Nullish(z.string()),
  targetProjectId: Nullish(z.number()),
  targetBranch: Nullish(z.string()),
  status: PullRequestStatus,
  workInProgress: Nullish(z.boolean()),
  submitterId: Nullish(z.number()),
  submitDate: Nullish(z.string()),
  closeDate: Nullish(z.string()),
});
export type PullRequest = z.infer<typeof PullRequest>;
export const PullRequestList = LooseArray(PullRequest);

export const BuildStatus = z.enum([
  'WAITING',
  'PENDING',
  'RUNNING',
  'FAILED',
  'CANCELLED',
  'TIMED_OUT',
  'SUCCESSFUL',
]);
export type BuildStatus = z.infer<typeof BuildStatus>;

export const Build = z.object({
  id: z.number(),
  projectId: Nullish(z.number()),
  jobName: Nullish(z.string()),
  status: BuildStatus,
});
export type Build = z.infer<typeof Build>;
export const BuildList = LooseArray(Build);

export const Issue = z.object({
  id: z.number(),
  number: z.number(),
  projectId: Nullish(z.number()),
  state: Nullish(z.string()),
  title: z.string(),
  description: Nullish(z.string()),
  submitDate: Nullish(z.string()),
  confidential: Nullish(z.boolean()),
  submitterId: Nullish(z.number()),
});
export type Issue = z.infer<typeof Issue>;
export const IssueList = LooseArray(Issue);

export const PullRequestComment = z.object({
  id: z.number(),
  requestId: Nullish(z.number()),
  content: Nullish(z.string()),
  messageId: Nullish(z.string()),
  date: Nullish(z.string()),
  userId: Nullish(z.number()),
});
export type PullRequestComment = z.infer<typeof PullRequestComment>;
export const PullRequestCommentList = LooseArray(PullRequestComment);

/** REST response of `GET /repositories/{projectId}/files`. */
export const RepositoryFile = z.object({
  base64Content: Nullish(z.string()),
  isPartial: Nullish(z.boolean()),
});
export type RepositoryFile = z.infer<typeof RepositoryFile>;

export const UserId = z.number();

/**
 * Subset of an issue form field spec (`GET /settings/issue` `fieldSpecs`
 * entries). Only what Renovate can fill in on issue creation is kept - the
 * field name, its choice list and whether an empty value is allowed. Further
 * field variants (user selections, build links, ...) are tolerated but
 * ignored.
 */
export const IssueFieldSpec = z.looseObject({
  name: z.string(),
  allowEmpty: Nullish(z.boolean()),
  choiceProvider: Nullish(
    z.looseObject({
      choices: Nullish(LooseArray(z.looseObject({ value: z.string() }))),
    }),
  ),
});
export type IssueFieldSpec = z.infer<typeof IssueFieldSpec>;

/** Response of `GET /settings/issue`. */
export const IssueSettings = z.looseObject({
  fieldSpecs: Nullish(LooseArray(IssueFieldSpec)),
});
export type IssueSettings = z.infer<typeof IssueSettings>;

/**
 * OneDev endpoints which create or identify entities answer with a plain
 * numeric id.
 */
export const NumericId = z.number();
