import { z } from 'zod/v3';
import { LooseArray } from '../../../util/schema-utils/index.ts';

export const RepologyPackageSchema = z.object({
  repo: z.string(),
  visiblename: z.string(),
  version: z.string(),
  srcname: z.string().nullable().optional(),
  binname: z.string().nullable().optional(),
  origversion: z.string().nullable().optional(),
});

export type RepologyPackageSchema = z.infer<typeof RepologyPackageSchema>;

export const RepologyPackagesSchema = LooseArray(RepologyPackageSchema).catch(
  [],
);
