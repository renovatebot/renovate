import { z } from 'zod/v4';

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
  homepage: z.string().optional().catch(undefined),
  deprecated: z.union([z.string(), z.boolean()]).optional(),
  gitHead: z.string().optional(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  engines: z
    .object({ node: z.string().optional() })
    .optional()
    .catch(undefined),
  dist: Distribution.optional(),
});

export const CachedPackument = z.object({
  versions: z.record(z.string(), Version).optional(),
  repository: Repository.optional(),
  homepage: z.string().optional(),
  time: z.record(z.string(), z.string()).optional(),
  'dist-tags': z.record(z.string(), z.string()).optional(),
});

/**
 * Full NpmResponse schema — used when fetching from the npm registry.
 * Lenient: only validates fields Renovate actually reads.
 * Uses passthrough() on the version objects to preserve extra fields
 * (e.g. 'renovate-config' used by config/presets/npm/index.ts).
 */
const NpmResponseVersion = Version.passthrough();

export const NpmResponseSchema = z.object({
  _id: z.string().optional(),
  name: z.string().optional(),
  versions: z.record(z.string(), NpmResponseVersion).optional(),
  repository: Repository.optional(),
  homepage: z.string().optional(),
  time: z.record(z.string(), z.string()).optional(),
  'dist-tags': z.record(z.string(), z.string()).optional(),
});

export type NpmResponseSchema = z.infer<typeof NpmResponseSchema>;
