import { z } from 'zod/v4';
import { Nullish } from '../../../util/schema-utils/index.ts';

export const BazelModuleMetadata = z.object({
  homepage: Nullish(z.string()),
  versions: z.array(z.string()),
  yanked_versions: z.record(z.string(), z.string()).optional(),
});

export type BazelModuleMetadata = z.infer<typeof BazelModuleMetadata>;
