import { z } from 'zod';

export const ReleaseResultZodSchema = z.object({
  releases: z.array(
    z.object({
      version: z.string(),
      isDeprecated: z.boolean().optional(),
      releaseTimestamp: z.string().optional(),
      sourceUrl: z.string().optional(),
      sourceDirectory: z.string().optional(),
      changelogUrl: z.string().optional(),
    }),
  ),
  sourceUrl: z.string().optional(),
  sourceDirectory: z.string().optional(),
  changelogUrl: z.string().optional(),
  homepage: z.string().optional(),
});
