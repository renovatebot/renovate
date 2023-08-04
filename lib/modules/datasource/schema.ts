import { z } from 'zod';

export const ReleasesConfig = z.object({
  packageName: z.string(),
  registryUrl: z.string(),
});
