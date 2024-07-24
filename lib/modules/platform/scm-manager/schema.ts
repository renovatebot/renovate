import { z } from 'zod';

const UserSchema = z.object({
  mail: z.string().optional(),
  displayName: z.string(),
  username: z.string(),
});

const ReviserSchema = z.object({
  id: z.string().optional(),
  displayName: z.string().optional(),
});

const PrStateSchema = z.enum(['DRAFT', 'OPEN', 'REJECTED', 'MERGED']);

const ReviewerSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  mail: z.string().optional(),
  approved: z.boolean(),
});

const TasksSchema = z.object({
  todo: z.number(),
  done: z.number(),
});

const LinkSchema = z.object({
  href: z.string(),
  name: z.string().optional(),
  templated: z.boolean().optional(),
});

const LinksSchema = z.record(
  z.string(),
  z.union([LinkSchema, z.array(LinkSchema)]),
);

const PrMergeMethodSchema = z.enum([
  'MERGE_COMMIT',
  'REBASE',
  'FAST_FORWARD_IF_POSSIBLE',
  'SQUASH',
]);

const PrConfigSchema = z.object({
  defaultConfig: z.object({
    mergeStrategy: PrMergeMethodSchema,
    deleteBranchOnMerge: z.boolean(),
  }),
});

const PullRequestSchema = z.object({
  id: z.string(),
  author: z.optional(UserSchema),
  reviser: z.optional(ReviserSchema),
  closeDate: z.string().optional(),
  source: z.string(),
  target: z.string(),
  title: z.string(),
  description: z.string(),
  creationDate: z.string(),
  lastModified: z.string().optional(),
  status: PrStateSchema,
  reviewer: z.array(ReviewerSchema).optional(),
  labels: z.string().array(),
  tasks: TasksSchema,
  _links: LinksSchema,
  _embedded: PrConfigSchema,
});

const RepoTypeSchema = z.enum(['git', 'svn', 'hg']);

const RepoSchema = z.object({
  contact: z.string(),
  creationDate: z.string(),
  description: z.string(),
  lastModified: z.string().optional(),
  namespace: z.string(),
  name: z.string(),
  type: RepoTypeSchema,
  archived: z.boolean(),
  exporting: z.boolean(),
  healthCheckRunning: z.boolean(),
  _links: LinksSchema,
});

const PagedSchema = z.object({
  page: z.number(),
  pageTotal: z.number(),
});

export const PagedPullRequestSchema = PagedSchema.extend({
  _embedded: z.object({
    pullRequests: z.array(PullRequestSchema),
  }),
});

export const PagedRepoSchema = PagedSchema.extend({
  _embedded: z.object({
    repositories: z.array(RepoSchema),
  }),
});
