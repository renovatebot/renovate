import { z } from 'zod/v4';
import { EmailAddress, LooseArray } from '../../../util/schema-utils/index.ts';

export const ContentsResponse = z.object({
  name: z.string(),
  path: z.string(),
  type: z.union([z.literal('file'), z.literal('dir')]),
  content: z.string().nullable(),
});

export type ContentsResponse = z.infer<typeof ContentsResponse>;

export const ContentsListResponse = z.array(ContentsResponse);

// Lenient User schema - email may not always be valid format in tests
export const UserSchema = z.object({
  id: z.number().optional(),
  email: EmailAddress.optional(),
  full_name: z.string().optional(),
  username: z.string().optional(),
});

const RepoPermissionSchema = z.object({
  admin: z.boolean().optional(),
  pull: z.boolean().optional(),
  push: z.boolean().optional(),
});

// Lenient Repo schema - only validates fields Renovate reads, most are optional
export const RepoSchema = z.object({
  id: z.number().optional(),
  allow_fast_forward_only_merge: z.boolean().optional(),
  allow_merge_commits: z.boolean().optional(),
  allow_rebase: z.boolean().optional(),
  allow_rebase_explicit: z.boolean().optional(),
  allow_squash_merge: z.boolean().optional(),
  archived: z.boolean().optional(),
  clone_url: z.string().optional(),
  default_merge_style: z.string().optional(),
  external_tracker: z.unknown().optional(),
  has_issues: z.boolean().optional(),
  has_pull_requests: z.boolean().optional(),
  ssh_url: z.string().optional(),
  default_branch: z.string().optional(),
  empty: z.boolean().optional(),
  fork: z.boolean().optional(),
  full_name: z.string(),
  mirror: z.boolean().optional(),
  owner: UserSchema.optional(),
  permissions: RepoPermissionSchema.optional(),
});

export const ForgejoLabelSchema = z.object({
  id: z.number().optional(),
  name: z.string().optional(),
});

export const LabelSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  color: z.string().optional(),
});

// Lenient partial repo schema for embedded repo references in PRs (only full_name is read)
const PartialRepoSchema = z
  .object({
    full_name: z.string(),
  })
  .passthrough();

export const PRSchema = z.object({
  number: z.number(),
  state: z.union([z.literal('open'), z.literal('closed'), z.literal('all')]),
  title: z.string(),
  body: z.string(),
  mergeable: z.boolean(),
  merged: z.boolean().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  diff_url: z.string().optional(),
  base: z
    .object({
      ref: z.string(),
    })
    .optional(),
  head: z
    .object({
      label: z.string(),
      sha: z.string(),
      repo: PartialRepoSchema.optional(),
    })
    .optional(),
  assignee: z
    .object({
      login: z.string().optional(),
    })
    .optional(),
  assignees: z.array(z.any()).optional(),
  user: z
    .object({
      username: z.string().optional(),
    })
    .optional(),
  labels: z.array(ForgejoLabelSchema).optional(),
});

export const NullablePRSchema = PRSchema.nullable();

export const PRListSchema = LooseArray(NullablePRSchema);

export const IssueSchema = z.object({
  number: z.number(),
  state: z
    .union([z.literal('open'), z.literal('closed'), z.literal('all')])
    .optional(),
  title: z.string(),
  body: z.string().optional(),
  assignees: z.array(UserSchema).optional(),
  labels: z.array(LabelSchema).optional(),
});

export const CommentSchema = z.object({
  id: z.number(),
  body: z.string(),
});

export const CommitStatusSchema = z.object({
  id: z.number(),
  // Accept any string as status; callers handle unknown values gracefully
  status: z.string(),
  context: z.string(),
  description: z.string().optional(),
  target_url: z.string().optional(),
  created_at: z.string(),
});

const CommitUserSchema = z.object({
  name: z.string().optional(),
  email: EmailAddress.optional(),
  username: z.string().optional(),
});

const CommitSchema = z.object({
  id: z.string(),
  author: CommitUserSchema,
});

export const BranchSchema = z.object({
  name: z.string(),
  commit: CommitSchema,
});

export const RepoSearchResultsSchema = z.object({
  ok: z.boolean(),
  data: z.array(RepoSchema),
});

export const RepoContentsSchema = z.object({
  path: z.string().optional(),
  content: z.string().optional(),
  contentString: z.string().optional(),
});

export const VersionSchema = z.object({
  version: z.string(),
});
