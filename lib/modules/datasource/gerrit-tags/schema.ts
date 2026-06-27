import { z } from 'zod/v3';

export const GerritTag = z.object({
  ref: z.string(),
  revision: z.string(),
  object: z.string().optional(),
});

export const GerritTags = z.array(GerritTag);

export const GerritBranchInfo = z.object({
  ref: z.string(),
  revision: z.string(),
});
