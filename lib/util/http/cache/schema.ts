import { z } from 'zod';

export const HttpCacheSchema = z
  .object({
    etag: z.string().optional(),
    lastModified: z.string().optional(),
    httpResponse: z.unknown(),
    timestamp: z.string(),
  })
  .nullable()
  .catch(null);
export type HttpCache = z.infer<typeof HttpCacheSchema>;
