import { z } from 'zod/v4';
import { Nullish } from '../../../util/schema-utils/index.ts';

export const BitbucketServerTag = z.object({
  displayId: z.string(),
  hash: Nullish(z.string()),
});

export const BitbucketServerTags = z.array(BitbucketServerTag);

export const BitbucketServerCommits = z.array(
  z.object({
    id: z.string(),
  }),
);
