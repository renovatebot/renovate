import { z } from 'zod/v4';

const HttpCacheHeaders = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]).optional(),
);

export const HttpCacheResponse = z.object({
  statusCode: z.number(),
  headers: HttpCacheHeaders,
  body: z.unknown(),
  authorization: z.boolean().optional(),
  cached: z.boolean().optional(),
});
export type HttpCacheResponse = z.infer<typeof HttpCacheResponse>;

export const HttpCache = z
  .object({
    etag: z.string().optional(),
    lastModified: z.string().optional(),
    httpResponse: HttpCacheResponse,
    timestamp: z.string(),
  })
  .nullable()
  .catch(null);
export type HttpCache = z.infer<typeof HttpCache>;
