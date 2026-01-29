import { z } from 'zod';
import { MaybeTimestamp } from '../../../util/timestamp.ts';

export const Release = z.object({
  name: z.string(),
  tag_name: z.string(),
  body: z.string(),
  prerelease: z.boolean(),
  published_at: MaybeTimestamp,
});

export const Releases = z.array(Release);
