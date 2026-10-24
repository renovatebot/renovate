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

export const UserId = z.number();

/**
 * OneDev endpoints which create or identify entities answer with a plain
 * numeric id.
 */
export const NumericId = z.number();
