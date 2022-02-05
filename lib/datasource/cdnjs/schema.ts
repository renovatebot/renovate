import { z } from 'zod';
import type { CdnjsResponse as CdnjsResponseDeprecated } from './types';

/**
 * See: https://cdnjs.com/api
 */
export const CdnjsResponseSchema = z.object({
  homepage: z.string().url().optional(),
  repository: z
    .object({
      url: z.string().url().optional(),
    })
    .optional()
    .nullable(),
  assets: z.array(
    z.object({
      version: z.string(),
      files: z.array(z.string()),
      sri: z.record(z.string()),
    })
  ),
});

// export type CdnjsResponse = z.infer<typeof CdnjsResponseSchema>;
export type CdnjsResponse = CdnjsResponseDeprecated;
