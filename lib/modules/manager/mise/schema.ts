import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const MiseToolSchema = z.union([
  z.string(),
  z.object({ version: z.string().optional() }),
  z.array(z.string()),
]);
export type MiseToolSchema = z.infer<typeof MiseToolSchema>;

export const MiseFileSchema = z.object({
  tools: z.record(MiseToolSchema),
});
export type MiseFileSchema = z.infer<typeof MiseFileSchema>;

export const MiseFileSchemaToml = Toml.pipe(MiseFileSchema);
