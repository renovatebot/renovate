import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp';

export const ReleaseSchema = z.object({
  name: z.string(),
  tag_name: z.string(),
  body: z.string(),
  prerelease: z.boolean(),
  published_at: MaybeTimestamp,
});

export const ReleasesSchema = z.array(ReleaseSchema);
