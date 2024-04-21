import { z } from 'zod';

const invalidFieldsMsg =
  'Cache object should have `etag` or `lastModified` fields';

export const HttpCacheSchema = z
  .object({
    // TODO: remove this migration part during the Christmas eve 2024
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
