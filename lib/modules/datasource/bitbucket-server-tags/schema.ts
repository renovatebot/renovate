import { z } from 'zod/v3';

export const BitbucketServerTag = z.object({
  displayId: z.string(),
  hash: z.string().nullish(),
});

export const BitbucketServerTags = z.array(BitbucketServerTag);

export const BitbucketServerCommits = z.array(
  z.object({
    id: z.string(),
  }),
);
