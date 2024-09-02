import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

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
