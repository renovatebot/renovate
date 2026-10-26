import { z } from 'zod/v4';
import { LongCommitSha } from '../../../util/schema-utils/git.ts';
import {
  DeepNullish,
  EmailAddress,
  LooseArray,
} from '../../../util/schema-utils/index.ts';
import { fromBase64 } from '../../../util/string.ts';

const ContentsCommon = z.object({
  name: z.string(),
  path: z.string(),
});

const ContentsFile = ContentsCommon.extend({
  type: z.literal('file'),
  content: z.string().nullable(),
}).transform((input) => ({
  ...input,
  contentString: input.content ? fromBase64(input.content) : '',
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

export const User = DeepNullish(
  z.object({
    id: z.number(),
    // catch empty strings which are returned if an organization has no email
    email: EmailAddress.optional().catch(undefined),
    full_name: z.string().optional(),
    login: z.string(),
  }),
);
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
export const Repo = DeepNullish(
  z.object({
    id: z.number(),
    allow_fast_forward_only_merge: z.boolean().default(false),
    allow_merge_commits: z.boolean().default(false),
    allow_rebase: z.boolean().default(false),
    allow_rebase_explicit: z.boolean().default(false),
    allow_squash_merge: z.boolean().default(false),
    archived: z.boolean().optional(),
    clone_url: z.string().optional(),
    // catch unknown merge methods e.g. `manually-merged`
    default_merge_style: PRMergeMethod.optional().catch(undefined),
    external_tracker: z.unknown().optional(),
    has_issues: z.boolean().optional().default(false),
    has_pull_requests: z.boolean().optional(),
    ssh_url: z.string().optional(),
    default_branch: z.string(),
    empty: z.boolean().optional(),
    fork: z.boolean().optional(),
    full_name: z.string(),
    mirror: z.boolean().optional(),
    owner: User,
    permissions: RepoPermission,
  }),
);
export type Repo = z.infer<typeof Repo>;

export const Label = DeepNullish(
  z.object({
    id: z.number(),
    name: z.string(),
    description: z.string().optional(),
    color: z.string().optional(),
  }),
);
export type Label = z.infer<typeof Label>;

export const PRState = z.enum(['open', 'closed', 'all']);
export type PRState = z.infer<typeof PRState>;

export const IssueState = z.enum(['open', 'closed', 'all']);
export type IssueState = z.infer<typeof IssueState>;

// Lenient partial repo schema for embedded repo references in PRs (only full_name is read)
const PartialRepo = z.object({
  full_name: z.string(),
});

export const PR = DeepNullish(
  z.object({
    number: z.number(),
    state: PRState,
    title: z.string(),
    body: z.string(),
    mergeable: z.boolean(),
    merged: z.boolean().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().optional(),
    diff_url: z.string().optional(),
    base: z
      .object({
        ref: z.string(),
      })
      .optional(),
    head: z
      .object({
        label: z.string(),
        sha: LongCommitSha,
        repo: PartialRepo.optional(),
      })
      .optional(),
    assignee: User.optional(),
    assignees: z.array(User).optional(),
    user: User.optional(),
    labels: z.array(Label).optional(),
  }),
);
export type PR = z.infer<typeof PR>;

// TODO remove when the TEMPORARY_ERROR in pr-cache.ts is no longer needed
export const NullablePR = PR.nullable();

export const PRList = LooseArray(NullablePR);

export const Issue = DeepNullish(
  z.object({
    number: z.number(),
    state: IssueState.optional(),
    title: z.string(),
    body: z.string(),
    assignees: z.array(User).optional(),
    labels: z.array(Label).optional(),
  }),
);
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

export const CommitStatus = DeepNullish(
  z.object({
    id: z.number(),
    status: CommitStatusType,
    context: z.string(),
    description: z.string().optional(),
    target_url: z.string().optional(),
    created_at: z.string(),
  }),
);
export type CommitStatus = z.infer<typeof CommitStatus>;

export const Commit = z.object({
  id: z.string(),
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
