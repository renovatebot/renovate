import { z } from 'zod/v4';
import { PagedResult } from '../../platform/bitbucket/schema.ts';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const BitbucketTag = z.object({
  name: z.string(),
  target: z
    .object({
      date: z.string().optional(),
      hash: z.string().optional(),
    })
    .optional(),
});
export type BitbucketTag = z.infer<typeof BitbucketTag>;

export const BitbucketTags = z
  .object({
    values: LooseArray(BitbucketTag),
  })
  .transform((body) => body.values);

export const BitbucketCommit = z.object({
  hash: z.string(),
  date: z.string().optional(),
});
export type BitbucketCommit = z.infer<typeof BitbucketCommit>;

export const BitbucketCommits = z
  .object({
    values: LooseArray(BitbucketCommit),
  })
  .transform((body) => body.values);
export const BitbucketCommitsResult = PagedResult(BitbucketCommit);

export const BitbucketTagsResult = PagedResult(BitbucketTag);



