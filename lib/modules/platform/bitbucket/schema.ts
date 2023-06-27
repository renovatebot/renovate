import { ZodSchema, z } from 'zod';
import type { PagedResult, SourceResults } from './types';

const BitbucketSourceTypeSchema = z.enum(['commit_directory', 'commit_file']);

const SourceResultsSchema: ZodSchema<SourceResults> = z.object({
  path: z.string(),
  type: BitbucketSourceTypeSchema,
  commit: z.object({
    hash: z.string(),
  }),
});

export const PagedSourceResultsSchema =
  createPagedResultSchema(SourceResultsSchema);

function createPagedResultSchema<T>(
  valuesSchema: ZodSchema<T>
): ZodSchema<PagedResult<T>> {
  return z.object({
    page: z.number().optional(),
    pagelen: z.number(),
    size: z.number().optional(),
    next: z.string().optional(),
    values: z.array(valuesSchema),
  });
}
