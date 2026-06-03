import { z } from 'zod/v4';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const RepologyPackage = z.object({
  repo: z.string(),
  visiblename: z.string(),
  version: z.string(),
  srcname: z.string().nullable().optional(),
  binname: z.string().nullable().optional(),
  origversion: z.string().nullable().optional(),
});

export type RepologyPackage = z.infer<typeof RepologyPackage>;

export const RepologyPackages = LooseArray(RepologyPackage).catch([]);
