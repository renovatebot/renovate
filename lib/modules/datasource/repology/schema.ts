import { z } from 'zod/v4';
import { DeepNullish, LooseArray } from '../../../util/schema-utils/index.ts';

export const RepologyPackage = DeepNullish(
  z.object({
    repo: z.string(),
    visiblename: z.string(),
    version: z.string(),
    srcname: z.string().optional(),
    binname: z.string().optional(),
    origversion: z.string().optional(),
  }),
);

export type RepologyPackage = z.infer<typeof RepologyPackage>;

export const RepologyPackages = LooseArray(RepologyPackage).catch([]);
