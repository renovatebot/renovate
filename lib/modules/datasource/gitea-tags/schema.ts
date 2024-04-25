import { z } from 'zod';

export const CommitSchema = z.object({
  sha: z.string(),
});

export const CommitsSchema = z.array(CommitSchema);

const TagCommitSchema = z.object({
  sha: z.string(),
  created: z.string().datetime({ offset: true }),
});

export const TagSchema = z.object({
  name: z.string(),
  commit: TagCommitSchema,
});
export const TagsSchema = z.array(TagSchema);
