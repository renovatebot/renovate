import { z } from 'zod';

export const ReleaseSchema = z.object({
  name: z.string(),
  tag_name: z.string(),
  body: z.string(),
  prerelease: z.boolean(),
  published_at: z.string().datetime({ offset: true }),
});

export const ReleasesSchema = z.array(ReleaseSchema);
