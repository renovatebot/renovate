import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const CargoDep = z.union([
  z.object({
    path: z.string().optional(),
    git: z.string().optional(),
    version: z.string().optional(),
    registry: z.string().optional(),
    package: z.string().optional(),
    workspace: z.boolean().optional(),
  }),
  z.string(),
]);

const CargoDeps = z.record(z.string(), CargoDep);

const CargoSection = z.object({
  dependencies: CargoDeps.optional(),
  'dev-dependencies': CargoDeps.optional(),
  'build-dependencies': CargoDeps.optional(),
});

export type CargoSection = z.infer<typeof CargoSection>;

const CargoWorkspace = z.object({
  dependencies: CargoDeps.optional(),
});

const CargoTarget = z.record(z.string(), CargoSection);

export const CargoManifestSchema = Toml.pipe(
  CargoSection.extend({
    package: z.object({ version: z.string().optional() }).optional(),
    workspace: CargoWorkspace.optional(),
    target: CargoTarget.optional(),
  }),
);

const CargoConfigRegistry = z.object({
  index: z.string().optional(),
});

const CargoConfigSource = z.object({
  'replace-with': z.string().optional(),
  registry: z.string().optional(),
});

export const CargoConfigSchema = Toml.pipe(
  z.object({
    registries: z.record(z.string(), CargoConfigRegistry).optional(),
    source: z.record(z.string(), CargoConfigSource).optional(),
  }),
);

export type CargoConfig = z.infer<typeof CargoConfigSchema>;

const CargoLockPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  source: z.string().optional(),
});

export const CargoLockSchema = z.object({
  package: z.array(CargoLockPackageSchema).optional(),
});

export type CargoLockSchema = z.infer<typeof CargoLockSchema>;

export const CargoLockSchemaToml = Toml.pipe(CargoLockSchema);
