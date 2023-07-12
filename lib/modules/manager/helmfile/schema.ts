import { z } from 'zod';

export const RepositorySchema = z.object({
  name: z.string(),
  url: z.string(),
  oci: z.boolean().optional(),
});

export const ReleaseSchema = z.object({
  name: z.string(),
  chart: z.string(),
  version: z.string(),
  strategicMergePatches: z.unknown().optional(),
  jsonPatches: z.unknown().optional(),
  transformers: z.unknown().optional(),
});

export const DocSchema = z.object({
  releases: z.array(ReleaseSchema).optional(),
  repositories: z.array(RepositorySchema).optional(),
});

export const LockSchema = z.object({
  version: z.string(),
});
