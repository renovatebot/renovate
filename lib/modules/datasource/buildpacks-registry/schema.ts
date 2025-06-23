import { z } from 'zod';

/**
 *  Response from registry.buildpacks.io
 */
export const BuildpacksRegistryResponseSchema = z.object({
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
