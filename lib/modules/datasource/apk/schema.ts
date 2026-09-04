import { z } from 'zod/v4';

/**
 * The cache validators of a downloaded `APKINDEX.tar.gz`.
 *
 * They are stored next to the extracted index so that a later run can ask the
 * registry whether the index changed, instead of downloading it again.
 */
export const ApkIndexValidators = z.object({
  etag: z.string().optional(),
  lastModified: z.string().optional(),
});
export type ApkIndexValidators = z.infer<typeof ApkIndexValidators>;
