import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';

// A requirement is a Hex version range, as a string or a `version` table, or a
// `path` or `git` table for a dependency that does not come from Hex.
const GleamDependency = z.union([
  z.string(),
  z.object({
    version: z.string().optional(),
    path: z.string().optional(),
    git: z.string().optional(),
  }),
]);

export const GleamToml = Toml.pipe(
  z.object({
    name: z.string(),
    dependencies: z.record(z.string(), GleamDependency).optional(),
    ['dev-dependencies']: z.record(z.string(), GleamDependency).optional(),
  }),
);

const Package = z.object({
  name: z.string(),
  version: z.string(),
  requirements: z.array(z.string()).optional(),
});

export const ManifestToml = Toml.pipe(
  z.object({
    packages: z.array(Package).optional(),
  }),
);

export type GleamDependency = z.infer<typeof GleamDependency>;
export type GleamToml = z.infer<typeof GleamToml>;
export type ManifestToml = z.infer<typeof ManifestToml>;
