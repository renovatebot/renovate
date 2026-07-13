import { z } from 'zod/v4';
import { EmailAddress } from '../../../util/schema-utils/index.ts';

export const User = z.object({
  mail: EmailAddress,
  displayName: z.string(),
  name: z.string(),
});
export type User = z.infer<typeof User>;

export const DefaultBranch = z.object({
  defaultBranch: z.string(),
});

export const Link = z.object({
  href: z.string(),
  name: z.string().nullish(),
  templated: z.boolean().nullish(),
});
export type Link = z.infer<typeof Link>;

export const Links = z.record(z.string(), z.union([Link, z.array(Link)]));
export type Links = z.infer<typeof Links>;

export const PrState = z.enum(['DRAFT', 'OPEN', 'REJECTED', 'MERGED']);
export type PrState = z.infer<typeof PrState>;

export const PrMergeMethod = z.enum([
  'MERGE_COMMIT',
  'REBASE',
  'FAST_FORWARD_IF_POSSIBLE',
  'FAST_FORWARD_ONLY',
  'SQUASH',
]);
export type PrMergeMethod = z.infer<typeof PrMergeMethod>;

export const PullRequest = z.object({
  id: z.string(),
  author: z
    .object({
      mail: z.string().nullish(),
      displayName: z.string(),
      id: z.string(),
    })
    .nullish(),
  reviser: z
    .object({
      id: z.string().nullish(),
      displayName: z.string().nullish(),
    })
    .nullish(),
  closeDate: z.string().nullish(),
  source: z.string(),
  target: z.string(),
  title: z.string(),
  description: z.string().nullish(),
  creationDate: z.string(),
  lastModified: z.string().nullish(),
  status: PrState,
  reviewer: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.string(),
        mail: z.string().nullish(),
        approved: z.boolean(),
      }),
    )
    .nullish(),
  labels: z.string().array(),
  tasks: z.object({
    todo: z.number(),
    done: z.number(),
  }),
  _links: Links,
  _embedded: z.object({
    defaultConfig: z.object({
      mergeStrategy: PrMergeMethod,
      deleteBranchOnMerge: z.boolean(),
    }),
  }),
});
export type PullRequest = z.infer<typeof PullRequest>;

const RepoType = z.enum(['git', 'svn', 'hg']);

export const Repo = z.object({
  contact: z.string().nullish(),
  creationDate: z.string().nullish(),
  description: z.string().nullish(),
  lastModified: z.string().nullish(),
  namespace: z.string(),
  name: z.string(),
  type: RepoType,
  archived: z.boolean(),
  exporting: z.boolean(),
  healthCheckRunning: z.boolean(),
  _links: Links,
});
export type Repo = z.infer<typeof Repo>;

const Paged = z.object({
  page: z.number(),
  pageTotal: z.number(),
});

export const PagedPullRequest = Paged.extend({
  _embedded: z.object({
    pullRequests: z.array(PullRequest),
  }),
});

export const PagedRepo = Paged.extend({
  _embedded: z.object({
    repositories: z.array(Repo),
  }),
});
