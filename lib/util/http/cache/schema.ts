import { z } from 'zod';

const invalidFieldsMsg =
  'Cache object should have `etag` or `lastModified` fields';

export const HttpCacheSchema = z
  .object({
    timeStamp: z.string().optional(),
    timestamp: z.string().optional(),
  })
  .passthrough()
  .transform((data) => {
    if (data.timeStamp) {
      data.timestamp = data.timeStamp;
      delete data.timeStamp;
    }
    return data;
  })
  .pipe(
    z
      .object({
        etag: z.string().optional(),
        lastModified: z.string().optional(),
        httpResponse: z.unknown(),
        timestamp: z.string(),
      })
      .refine(
        ({ etag, lastModified }) => etag ?? lastModified,
        invalidFieldsMsg,
      ),
  )
  .nullable()
  .catch(null);
