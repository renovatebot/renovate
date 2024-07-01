import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const MisePackageValueSchema = z.union([
  z.string(),
  z.object({ version: z.string() }),
  z.array(z.string()),
]);
export type MisePackageValueSchema = z.infer<typeof MisePackageValueSchema>;

export const MisePackagesSchema = z.record(MisePackageValueSchema);

export const MiseFileSchema = z.object({
  tools: MisePackagesSchema.optional(),
});
export type MiseFileSchema = z.infer<typeof MiseFileSchema>;

export const MiseFileSchemaToml = Toml.pipe(MiseFileSchema);
