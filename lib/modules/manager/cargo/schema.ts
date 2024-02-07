import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

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
