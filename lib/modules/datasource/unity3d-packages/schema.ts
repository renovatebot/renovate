import { z } from 'zod';

const UnityPackageRelease = z.object({
  documentationUrl: z.string().optional(),
  version: z.string(),
});

export const UnityPackageReleasesJSON = z.object({
  versions: z.record(z.string(), UnityPackageRelease),
  time: z.record(z.string(), z.string()),
});
