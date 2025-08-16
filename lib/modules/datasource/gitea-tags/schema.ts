import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export const Commit = z.object({
  sha: z.string(),
});

export const Commits = z.array(Commit);

const TagCommit = z.object({
  sha: z.string(),
  created: MaybeTimestamp,
});

export const Tag = z.object({
  name: z.string(),
  commit: TagCommit,
});
export const Tags = z.array(Tag);
