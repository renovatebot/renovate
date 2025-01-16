import { z } from 'zod';
import { TimestampSchema } from '../../../util/timestamp';

export const ReleaseSchema = z.object({
  name: z.string(),
  tag_name: z.string(),
  body: z.string(),
  prerelease: z.boolean(),
  published_at: TimestampSchema.nullable().catch(null),
});

export const ReleasesSchema = z.array(ReleaseSchema);
