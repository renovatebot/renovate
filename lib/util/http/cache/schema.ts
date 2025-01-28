import { z } from 'zod';

export const HttpCacheSchema = z
  .object({
    etag: z.string().optional(),
    lastModified: z.string().optional(),
    httpResponse: z.unknown(),
    timestamp: z.string(),
  })
  .refine(
    ({ etag, lastModified }) => etag ?? lastModified,
    'Cache object should have `etag` or `lastModified` fields',
  )
  .nullable()
  .catch(null);
export type HttpCache = z.infer<typeof HttpCacheSchema>;
