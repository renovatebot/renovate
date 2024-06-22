import { z } from 'zod';

export const BazelModuleMetadata = z.object({
  versions: z.array(z.string()),
  yanked_versions: z.record(z.string(), z.string()),
});
