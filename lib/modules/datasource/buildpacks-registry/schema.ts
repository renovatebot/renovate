import { z } from 'zod/v4';

/**
 *  Response from registry.buildpacks.io
 */
export const BuildpacksRegistryResponse = z.object({
  latest: z
    .object({
      homepage: z.string().optional(),
    })
    .optional(),
  versions: z
    .object({
      version: z.string(),
    })
    .array(),
});
