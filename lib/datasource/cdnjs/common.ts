import { z } from 'zod';
import type { CdnjsResponse } from './types';

/**
 * See: https://cdnjs.com/api
 */
export const Response = z.object({
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

// export type IResponse = z.infer<typeof Response>;
export type IResponse = CdnjsResponse;
