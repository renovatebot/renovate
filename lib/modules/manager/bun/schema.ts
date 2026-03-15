import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const BunfigRegistrySchema = z.union([
  z.string(),
  z.object({ url: z.string() }).transform((val) => val.url),
]);

const BunfigInstallSchema = z.object({
  registry: BunfigRegistrySchema.optional(),
  scopes: z.record(z.string(), BunfigRegistrySchema).optional(),
});

export const BunfigSchema = z.object({
  install: BunfigInstallSchema.optional(),
});

export const BunfigConfig = Toml.pipe(BunfigSchema);
export type BunfigConfig = z.infer<typeof BunfigConfig>;
