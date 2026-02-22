import { z } from 'zod/v3';

export const ReleasesConfig = z.object({
  packageName: z.string(),
  registryUrl: z.string(),
});

export const DigestsConfig = z.object({
  packageName: z.string(),
  registryUrl: z.string(),
});
