import { z } from 'zod';

const UnityPackageRelease = z.object({
  documentationUrl: z.string(),
  version: z.string(),
});

export const UnityPackageReleasesJSON = z.object({
  versions: UnityPackageRelease.array(),
  time: z.record(z.string(), z.string()),
});
