import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';

// Reusable paged result wrapper
export const PagedResult = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    page: z.number().optional(),
    pagelen: z.number().optional(),
    size: z.number().optional(),
    next: z.string().optional(),
    values: z.array(item),
  });

// Account schema (maps to types.ts Account interface)
export const Account = z.object({
  display_name: z.string().optional(),
  uuid: z.string(),
  nickname: z.string().optional(),
  account_status: z.string().optional(),
});
export type Account = z.infer<typeof Account>;

// UserInfo schema for the /2.0/users/{uuid} endpoint (only account_status is needed)
export const UserInfo = z.object({
  uuid: z.string().optional(),
  account_status: z.string().optional(),
});
export type UserInfo = z.infer<typeof UserInfo>;

// RepoBranchingModel schema
export const RepoBranchingModel = z.object({
  development: z.object({
    name: z.string(),
    branch: z
      .object({
        name: z.string(),
      })
      .optional(),
  }),
});
export type RepoBranchingModel = z.infer<typeof RepoBranchingModel>;

// BranchResponse schema
export const BranchResponse = z.object({
  target: z.object({
    hash: z.string(),
  }),
});
export type BranchResponse = z.infer<typeof BranchResponse>;

// BitbucketStatus schema
export const BitbucketStatus = z.object({
  key: z.string(),
  state: z.enum(['SUCCESSFUL', 'FAILED', 'INPROGRESS']),
});
export type BitbucketStatus = z.infer<typeof BitbucketStatus>;

// PrResponse schema
export const PrResponse = z.object({
  id: z.number(),
  title: z.string(),
  state: z.string(),
  links: z
    .object({
      commits: z.object({
        href: z.string(),
      }),
    })
    .optional(),
  summary: z.object({ raw: z.string() }).optional(),
  source: z.object({
    branch: z.object({
      name: z.string(),
    }),
  }),
  destination: z.object({
    branch: z.object({
      name: z.string(),
    }),
  }),
  reviewers: z.array(Account).default([]),
  created_on: z.string(),
  updated_on: z.string().optional(),
});
export type PrResponse = z.infer<typeof PrResponse>;

// EffectiveReviewer schema
export const EffectiveReviewer = z.object({
  type: z.string().optional(),
  reviewer_type: z.string().optional(),
  user: Account,
});
export type EffectiveReviewer = z.infer<typeof EffectiveReviewer>;

// Comment schema for comments.ts
export const Comment = z.object({
  content: z.object({ raw: z.string() }),
  id: z.number().optional(),
  user: Account.optional(),
});
export type Comment = z.infer<typeof Comment>;

// BbIssue schema for issues in index.ts
export const BbIssue = z.object({
  id: z.number(),
  title: z.string(),
  kind: z.string(),
  content: z.object({ raw: z.string() }).optional(),
});
export type BbIssue = z.infer<typeof BbIssue>;

const BitbucketSourceType = z.enum(['commit_directory', 'commit_file']);

const SourceResults = z.object({
  path: z.string(),
  type: BitbucketSourceType,
  commit: z.object({
    hash: z.string(),
  }),
});

const Paged = z.object({
  page: z.number().optional(),
  pagelen: z.number(),
  size: z.number().optional(),
  next: z.string().optional(),
});

export const PagedSourceResults = Paged.extend({
  values: z.array(SourceResults),
});

export const RepoInfo = z
  .object({
    parent: z.unknown().optional().catch(undefined),
    mainbranch: z.object({
      name: z.string(),
    }),
    has_issues: z.boolean().catch(() => {
      return false;
    }),
    uuid: z.string(),
    full_name: z
      .string()
      .regex(
        /^[^/]+\/[^/]+$/,
        'Expected repository full_name to be in the format "owner/repo"',
      ),
    is_private: z.boolean().catch(() => {
      logger.once.warn('Bitbucket: "is_private" field missing from repo info');
      return true;
    }),
    project: z
      .object({
        name: z.string(),
      })
      .nullable()
      .catch(null),
  })
  .transform((repoInfoBody) => {
    const isFork = !!repoInfoBody.parent;
    const [owner, name] = repoInfoBody.full_name.split('/');

    return {
      isFork,
      owner,
      name,
      mainbranch: repoInfoBody.mainbranch.name,
      mergeMethod: 'merge',
      has_issues: repoInfoBody.has_issues,
      uuid: repoInfoBody.uuid,
      is_private: repoInfoBody.is_private,
      projectName: repoInfoBody.project?.name,
    };
  });
export type RepoInfo = z.infer<typeof RepoInfo>;

export const Repositories = z
  .object({
    values: LooseArray(RepoInfo),
  })
  .transform((body) => body.values);

const TaskState = z.union([z.literal('RESOLVED'), z.literal('UNRESOLVED')]);

const PrTask = z.object({
  id: z.number(),
  state: TaskState,
  content: z.object({
    raw: z.string(),
  }),
});

export type PrTask = z.infer<typeof PrTask>;

export const UnresolvedPrTasks = z
  .object({
    values: z.array(PrTask),
  })
  .transform((data) =>
    data.values.filter((task) => task.state === 'UNRESOLVED'),
  );

const WorkspaceAccess = z.object({
  workspace: z.object({
    slug: z.string(),
  }),
});

export const WorkspaceAccesses = z
  .object({
    values: z.array(WorkspaceAccess),
  })
  .transform((body) => body.values.map(({ workspace }) => workspace.slug));
