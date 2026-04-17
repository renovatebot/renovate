import { z } from 'zod/v3';

const Repository = z.union([
  z.string(),
  z.object({
    url: z.string().optional(),
    directory: z.string().optional(),
  }),
]);

const Attestations = z.object({
  url: z.string().optional(),
});

const Distribution = z.object({
  attestations: Attestations.optional(),
});

const Version = z.object({
  repository: Repository.optional(),
  homepage: z.string().optional(),
  deprecated: z.union([z.string(), z.boolean()]).optional(),
  gitHead: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  engines: z
    .object({ node: z.string().optional() })
    .optional()
    .catch(undefined),
  dist: Distribution.optional(),
});

export const CachedPackument = z.object({
  versions: z.record(Version).optional(),
  repository: Repository.optional(),
  homepage: z.string().optional(),
  time: z.record(z.string()).optional(),
  'dist-tags': z.record(z.string()).optional(),
});
