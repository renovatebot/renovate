import { z } from 'zod';
import { logger } from '../../../logger';
import { LooseArray } from '../../../util/schema-utils';

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
    mainbranch: z.object({
      name: z.string(),
    }),
    has_issues: z.boolean().catch(() => {
      logger.once.warn('Bitbucket: "has_issues" field missing from repo info');
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
