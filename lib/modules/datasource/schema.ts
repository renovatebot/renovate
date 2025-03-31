import { z } from 'zod';

export const ReleasesConfig = z.object({
  packageName: z.string().length(40),
  registryUrl: z.string(),
});

export const DigestsConfig = z.object({
  packageName: z.string(),
  registryUrl: z.string(),
});
