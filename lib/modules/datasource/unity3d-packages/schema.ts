import { z } from 'zod';

const Upm = z.object({
  changelog: z.string().optional(),
});

const UnityPackageRelease = z.object({
  _upm: Upm.optional(),
  documentationUrl: z.string().optional(),
  version: z.string(),
});

export const UnityPackageReleasesJSON = z.object({
  versions: z.record(z.string(), UnityPackageRelease),
  time: z.record(z.string(), z.string()),
});
