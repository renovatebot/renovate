import { z } from 'zod/v4';

const Repository = z.union([
  z.string(),
  z.object({
    url: z.string().nullish(),
    directory: z.string().nullish(),
  }),
]);

const Attestations = z.object({
  url: z.string().optional(),
});

const Distribution = z.object({
  attestations: Attestations.optional(),
});

/**
 * The packument `time` field maps each published version to its release
 * timestamp, alongside metadata keys such as `created`, `modified`, and
 * `unpublished`. Some registries (e.g. JFrog Artifactory) emit non-string
 * values like `"unpublished": null`, which must not invalidate the whole
 * packument. Drop any non-string entries so consumers only ever see
 * version→timestamp strings.
 */
const PackumentTime = z
  .record(z.string(), z.unknown())
  .transform((time) =>
    Object.fromEntries(
      Object.entries(time).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
  );

export const NpmResponseVersion = z.object({
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
export type NpmResponseVersion = z.infer<typeof NpmResponseVersion>;

export const CachedPackument = z.object({
  versions: z.record(z.string(), NpmResponseVersion).optional(),
  repository: Repository.optional(),
  homepage: z.string().optional(),
  time: PackumentTime.optional(),
  'dist-tags': z.record(z.string(), z.string()).optional(),
});

/**
 * Full NpmResponse schema — used when fetching from the npm registry.
 * Lenient: only validates fields Renovate actually reads.
 * Uses loose() on the version objects to preserve extra fields
 * (e.g. 'renovate-config' used by config/presets/npm/index.ts).
 */
const NpmResponseVersionLoose = NpmResponseVersion.loose();

export const NpmResponse = z.object({
  _id: z.string().optional(),
  name: z.string().optional(),
  versions: z.record(z.string(), NpmResponseVersionLoose).optional(),
  repository: Repository.optional(),
  homepage: z.string().optional(),
  time: PackumentTime.optional(),
  'dist-tags': z.record(z.string(), z.string()).optional(),
});

export type NpmResponse = z.infer<typeof NpmResponse>;
