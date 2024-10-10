import { z } from 'zod';

export const UserSchema = z.object({
  mail: z.string().optional().nullable(),
  displayName: z.string(),
  name: z.string(),
});

export const DefaultBranchSchema = z.object({
  defaultBranch: z.string(),
});

export const LinkSchema = z.object({
  href: z.string(),
  name: z.string().optional().nullable(),
  templated: z.boolean().optional().nullable(),
});

export const LinksSchema = z.record(
  z.string(),
  z.union([LinkSchema, z.array(LinkSchema)]),
);

export const PrStateSchema = z.enum(['DRAFT', 'OPEN', 'REJECTED', 'MERGED']);

export const PrMergeMethodSchema = z.enum([
  'MERGE_COMMIT',
  'REBASE',
  'FAST_FORWARD_IF_POSSIBLE',
  'SQUASH',
]);

export const PullRequestSchema = z.object({
  id: z.string(),
  author: z
    .object({
      mail: z.string().optional().nullable(),
      displayName: z.string(),
      id: z.string(),
    })
    .optional()
    .nullable(),
  reviser: z
    .object({
      id: z.string().optional().nullable(),
      displayName: z.string().optional().nullable(),
    })
    .optional()
    .nullable(),
  closeDate: z.string().optional().nullable(),
  source: z.string(),
  target: z.string(),
  title: z.string(),
  description: z.string(),
  creationDate: z.string(),
  lastModified: z.string().optional().nullable(),
  status: PrStateSchema,
  reviewer: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        mail: z.string().optional().nullable(),
        approved: z.boolean(),
      }),
    )
    .optional()
    .nullable(),
  labels: z.string().array(),
  tasks: z.object({
    todo: z.number(),
    done: z.number(),
  }),
  _links: LinksSchema,
  _embedded: z.object({
    defaultConfig: z.object({
      mergeStrategy: PrMergeMethodSchema,
      deleteBranchOnMerge: z.boolean(),
    }),
  }),
});

const RepoTypeSchema = z.enum(['git', 'svn', 'hg']);

export const RepoSchema = z.object({
  contact: z.string(),
  creationDate: z.string(),
  description: z.string(),
  lastModified: z.string().optional().nullable(),
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
