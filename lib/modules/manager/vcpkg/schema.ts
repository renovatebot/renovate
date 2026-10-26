import { z } from 'zod/v4';
import { Json } from '../../../util/schema-utils/index.ts';

const DependencyEntry = z.union([
  z.string(),
  z.object({
    name: z.string(),
    'version>=': z.string().optional(),
  }),
]);

const OverrideEntry = z.object({
  name: z.string(),
  version: z.string().optional(),
  'version-semver': z.string().optional(),
  'version-date': z.string().optional(),
  'version-string': z.string().optional(),
  'port-version': z.number().int().nonnegative().optional(),
});

export const VcpkgManifest = Json.pipe(
  z.object({
    version: z.string().optional(),
    'version-semver': z.string().optional(),
    'version-date': z.string().optional(),
    'version-string': z.string().optional(),
    dependencies: z.array(DependencyEntry).optional(),
    overrides: z.array(OverrideEntry).optional(),
  }),
);
