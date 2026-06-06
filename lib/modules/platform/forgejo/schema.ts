import { z } from 'zod/v4';
import {
  EmailAddress,
  LooseArray,
  Nullish,
} from '../../../util/schema-utils/index.ts';

export const ContentsResponse = z.object({
  name: z.string(),
  path: z.string(),
  type: z.union([z.literal('file'), z.literal('dir')]),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponse>;

export const ContentsListResponse = z.array(ContentsResponse);

// Lenient User schema - email may not always be valid format in tests
export const User = z.object({
  id: z.number().optional(),
  email: Nullish(EmailAddress),
  full_name: Nullish(z.string()),
  username: Nullish(z.string()),
});
export type User = z.infer<typeof User>;

export const RepoPermission = z.object({
  admin: Nullish(z.boolean()),
  pull: Nullish(z.boolean()),
  push: Nullish(z.boolean()),
});
export type RepoPermission = z.infer<typeof RepoPermission>;

export const PRMergeMethod = z.enum([
  'fast-forward-only',
  'merge',
  'rebase',
  'rebase-merge',
  'squash',
]);
export type PRMergeMethod = z.infer<typeof PRMergeMethod>;

// Lenient Repo schema - only validates fields Renovate reads, most are optional
export const Repo = z.object({
  id: z.number().optional(),
  allow_fast_forward_only_merge: Nullish(z.boolean()),
  allow_merge_commits: Nullish(z.boolean()),
  allow_rebase: Nullish(z.boolean()),
  allow_rebase_explicit: Nullish(z.boolean()),
  allow_squash_merge: Nullish(z.boolean()),
  archived: Nullish(z.boolean()),
  clone_url: Nullish(z.string()),
  default_merge_style: Nullish(PRMergeMethod),
  external_tracker: z.unknown().optional(),
  has_issues: Nullish(z.boolean()),
  has_pull_requests: Nullish(z.boolean()),
  ssh_url: Nullish(z.string()),
  default_branch: Nullish(z.string()),
  empty: Nullish(z.boolean()),
  fork: Nullish(z.boolean()),
  full_name: z.string(),
  mirror: Nullish(z.boolean()),
  owner: User.optional(),
  permissions: RepoPermission.optional(),
});
export type Repo = z.infer<typeof Repo>;

export const ForgejoLabel = z.object({
  id: z.number().optional(),
  name: Nullish(z.string()),
});

export const Label = z.object({
  id: z.number(),
  name: z.string(),
  description: Nullish(z.string()),
  color: Nullish(z.string()),
});
export type Label = z.infer<typeof Label>;

export const PRState = z.enum(['open', 'closed', 'all']);
export type PRState = z.infer<typeof PRState>;

export const IssueState = z.enum(['open', 'closed', 'all']);
export type IssueState = z.infer<typeof IssueState>;

// Lenient partial repo schema for embedded repo references in PRs (only full_name is read)
const PartialRepo = z
  .object({
    full_name: z.string(),
  })
  .passthrough();

export const PR = z.object({
  number: z.number(),
  state: PRState,
  title: z.string(),
  body: z.string(),
  mergeable: z.boolean(),
  merged: Nullish(z.boolean()),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: Nullish(z.string()),
  diff_url: Nullish(z.string()),
  base: z
    .object({
      ref: z.string(),
    })
    .optional(),
  head: z
    .object({
      label: z.string(),
      sha: z.string(),
      repo: PartialRepo.optional(),
    })
    .optional(),
  assignee: z
    .object({
      login: Nullish(z.string()),
    })
    .optional(),
  assignees: z.array(z.any()).optional(),
  user: z
    .object({
      username: Nullish(z.string()),
    })
    .optional(),
  labels: z.array(ForgejoLabel).optional(),
});
export type PR = z.infer<typeof PR>;

export const NullablePR = PR.nullable();

export const PRList = LooseArray(NullablePR);

export const Issue = z.object({
  number: z.number(),
  state: IssueState.optional(),
  title: z.string(),
  body: Nullish(z.string()),
  assignees: z.array(User).optional(),
  labels: z.array(Label).optional(),
});
export type Issue = z.infer<typeof Issue>;

export const Comment = z.object({
  id: z.number(),
  body: z.string(),
});
export type Comment = z.infer<typeof Comment>;

export const CommitStatusType = z
  .enum(['pending', 'success', 'error', 'failure', 'warning', 'unknown'])
  .catch('unknown');
export type CommitStatusType = z.infer<typeof CommitStatusType>;

export const CommitStatus = z.object({
  id: z.number(),
  status: CommitStatusType,
  context: z.string(),
  description: Nullish(z.string()),
  target_url: Nullish(z.string()),
  created_at: z.string(),
});
export type CommitStatus = z.infer<typeof CommitStatus>;

const CommitUser = z.object({
  name: Nullish(z.string()),
  email: Nullish(EmailAddress),
  username: Nullish(z.string()),
});

export const Commit = z.object({
  id: z.string(),
  author: CommitUser,
});
export type Commit = z.infer<typeof Commit>;

export const Branch = z.object({
  name: z.string(),
  commit: Commit,
});
export type Branch = z.infer<typeof Branch>;

export const RepoSearchResults = z.object({
  ok: z.boolean(),
  data: z.array(Repo),
});

export const RepoContents = z.object({
  path: Nullish(z.string()),
  content: Nullish(z.string()),
  contentString: Nullish(z.string()),
});
export type RepoContents = z.infer<typeof RepoContents>;

export const Version = z.object({
  version: z.string(),
});
