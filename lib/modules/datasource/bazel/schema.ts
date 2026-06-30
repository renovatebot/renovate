import { z } from 'zod/v4';

export const BazelModuleMetadata = z.object({
  homepage: z.string().optional().nullable(),
  versions: z.array(z.string()),
  yanked_versions: z.record(z.string(), z.string()).optional(),
});

export type BazelModuleMetadata = z.infer<typeof BazelModuleMetadata>;
