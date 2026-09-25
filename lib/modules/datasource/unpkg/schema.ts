import { z } from 'zod/v4';

export const UnpkgFile = z.object({
  path: z.string(),
  integrity: z.string().optional().catch(undefined),
});

export const UnpkgDigestResponse = z.object({
  files: z.array(UnpkgFile),
});
