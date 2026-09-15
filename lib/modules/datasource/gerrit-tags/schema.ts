import { z } from 'zod/v4';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const GerritTag = z.object({
  ref: z.string(),
  revision: z.string(),
  object: z.string().optional(),
  created: MaybeTimestamp,
});

export const GerritTags = z.array(GerritTag);

export const GerritBranchInfo = z.object({
  ref: z.string(),
  revision: z.string(),
});
