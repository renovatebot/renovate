import { z } from 'zod/v4';

export const UnpkgPackageResponse = z.object({
  package: z.string(),
  prefix: z.string(),
  version: z.string(),
});

export const UnpkgFile = z.object({
  path: z.string(),
  integrity: z.string().optional().catch(undefined),
});

export const UnpkgDigestResponse = z.object({
  files: z.array(UnpkgFile),
});
