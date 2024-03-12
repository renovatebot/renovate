import { z } from 'zod';

const BitbucketSourceTypeSchema = z.enum(['commit_directory', 'commit_file']);

const SourceResultsSchema = z.object({
  path: z.string(),
  type: BitbucketSourceTypeSchema,
  commit: z.object({
    hash: z.string(),
  }),
});

const PagedSchema = z.object({
  page: z.number().optional(),
  pagelen: z.number(),
  size: z.number().optional(),
  next: z.string().optional(),
});

export const PagedSourceResultsSchema = PagedSchema.extend({
  values: z.array(SourceResultsSchema),
});

export const RepoInfo = z
  .object({
    parent: z.unknown().optional().catch(undefined),
    owner: z.object({
      username: z.string().optional(),
    }),
    mainbranch: z.object({
      name: z.string(),
    }),
    has_issues: z.boolean(),
    uuid: z.string(),
    full_name: z
      .string()
      .regex(
        /^[^/]+\/[^/]+$/,
        'Expected repository full_name to be in the format "owner/repo"',
      ),
    is_private: z.boolean(),
  })
  .transform((repoInfoBody) => {
    const isFork = !!repoInfoBody.parent;
    const [owner] = repoInfoBody.full_name.split('/');

    return {
      isFork,
      owner,
      mainbranch: repoInfoBody.mainbranch.name,
      mergeMethod: 'merge',
      has_issues: repoInfoBody.has_issues,
      uuid: repoInfoBody.uuid,
      is_private: repoInfoBody.is_private,
    };
  });
export type RepoInfo = z.infer<typeof RepoInfo>;

export const RepositoryNames = z
  .object({
    values: z.array(
      z.object({
        full_name: z.string(),
      }),
    ),
  })
  .transform((body) => body.values.map((repo) => repo.full_name));
