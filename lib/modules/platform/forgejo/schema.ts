import { z } from 'zod/v4';
import {
  EmailAddress,
  LooseArray,
  Nullish,
} from '../../../util/schema-utils/index.ts';
import { fromBase64 } from '../../../util/string.ts';

const ContentsCommon = z.object({
  name: z.string(),
  path: z.string(),
});

const ContentsFile = ContentsCommon.extend({
  type: z.literal('file'),
  content: z.string(),
}).transform((input) => ({
  ...input,
  contentString: fromBase64(input.content),
}));

const ContentsDir = ContentsCommon.extend({ type: z.literal('dir') });
const ContentsSymlink = ContentsCommon.extend({ type: z.literal('symlink') });
const ContentsSubmodule = ContentsCommon.extend({
  type: z.literal('submodule'),
});

export const RepoContents = z.discriminatedUnion('type', [
  ContentsFile,
  ContentsDir,
  ContentsSymlink,
  ContentsSubmodule,
]);
export type RepoContents = z.infer<typeof RepoContents>;

export const ContentsListResponse = z.array(RepoContents);

export const User = z.object({
  id: z.number(),
  email: Nullish(EmailAddress),
  full_name: Nullish(z.string()),
  username: z.string(),
});
export type User = z.infer<typeof User>;

export const RepoPermission = z.object({
  admin: z.boolean(),
  pull: z.boolean(),
  push: z.boolean(),
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
  id: z.number(),
  allow_fast_forward_only_merge: z.boolean().default(false),
  allow_merge_commits: z.boolean().default(false),
  allow_rebase: z.boolean().default(false),
  allow_rebase_explicit: z.boolean().default(false),
  allow_squash_merge: z.boolean().default(false),
  archived: Nullish(z.boolean()),
  clone_url: Nullish(z.string()),
  // catch unknown merge methods e.g. `manually-merged`
  default_merge_style: Nullish(PRMergeMethod).catch(undefined),
  external_tracker: z.unknown().optional(),
  has_issues: Nullish(z.boolean()).default(false),
  has_pull_requests: Nullish(z.boolean()),
  ssh_url: Nullish(z.string()),
  default_branch: z.string(),
  empty: Nullish(z.boolean()),
  fork: Nullish(z.boolean()),
  full_name: z.string(),
  mirror: Nullish(z.boolean()),
  owner: User,
  permissions: RepoPermission,
});
export type Repo = z.infer<typeof Repo>;

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
  labels: z.array(Label).optional(),
});
export type PR = z.infer<typeof PR>;

// TODO remove when the TEMPORARY_ERROR in pr-cache.ts is no longer needed
export const NullablePR = PR.nullable();

export const PRList = LooseArray(NullablePR);

export const Issue = z.object({
  number: z.number(),
  state: IssueState.optional(),
  title: z.string(),
  body: z.string(),
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

export const Version = z.object({
  version: z.string(),
});
