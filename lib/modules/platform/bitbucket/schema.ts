import { z } from 'zod';

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
