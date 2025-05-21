import { z } from 'zod';

export const GlasskubePackageVersions = z.object({
  latestVersion: z.string(),
  versions: z.array(z.object({ version: z.string() })),
});

export const GlasskubePackageManifest = z.object({
  references: z.optional(
    z.array(
      z.object({
        label: z.string(),
        url: z.string(),
      }),
    ),
  ),
});
