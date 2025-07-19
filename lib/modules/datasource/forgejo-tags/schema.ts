import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export const CommitSchema = z.object({
  sha: z.string(),
});

export const CommitsSchema = z.array(CommitSchema);

const TagCommitSchema = z.object({
  sha: z.string(),
  created: MaybeTimestamp,
});

export const TagSchema = z.object({
  name: z.string(),
  commit: TagCommitSchema,
});
export const TagsSchema = z.array(TagSchema);
