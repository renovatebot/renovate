import { z } from 'zod';
import { Yaml } from '../../../util/schema-utils';

export const HelmRepository = z.object({
  name: z.string(),
  url: z.string(),
  oci: z.boolean().optional(),
});
export type HelmRepository = z.infer<typeof HelmRepository>;

export const HelmRelease = z.object({
  name: z.string(),
  chart: z.string(),
  version: z.string(),
  strategicMergePatches: z.unknown().optional(),
  jsonPatches: z.unknown().optional(),
  transformers: z.unknown().optional(),
});
export type HelmRelease = z.infer<typeof HelmRelease>;

export const Doc = z.object({
  releases: z.array(HelmRelease).optional(),
  repositories: z.array(HelmRepository).optional(),
});
export type Doc = z.infer<typeof Doc>;

export const LockVersion = Yaml.pipe(
  z.object({ version: z.string() }).transform(({ version }) => version),
);
export type LockVersion = z.infer<typeof LockVersion>;
