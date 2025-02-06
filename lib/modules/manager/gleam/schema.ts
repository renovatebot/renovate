import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

export const GleamToml = Toml.pipe(
  z.object({
    name: z.string(),
    dependencies: z.record(z.string(), z.string()).optional(),
    ['dev-dependencies']: z.record(z.string(), z.string()).optional(),
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

export type GleamToml = z.infer<typeof GleamToml>;
export type ManifestToml = z.infer<typeof ManifestToml>;
