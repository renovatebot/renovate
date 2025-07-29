import { z } from 'zod';

export const BitbucketServerTag = z.object({
  displayId: z.string(),
  hash: z.string().nullable(),
});

export const BitbucketServerTags = z.array(BitbucketServerTag);

export const BitbucketServerCommits = z.array(
  z.object({
    id: z.string(),
  }),
);
