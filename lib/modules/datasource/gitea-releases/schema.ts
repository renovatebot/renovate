import { z } from 'zod';

export const ReleaseSchema = z.object({
  tag_name: z.string(),
  prerelease: z.boolean(),
  published_at: z.string().datetime({ offset: true }),
});

export const ReleasesSchema = z.array(ReleaseSchema);
