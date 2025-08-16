import { z } from 'zod';
import { Toml } from '../../../util/schema-utils';

const MiseToolOptions = z.object({
  // ubi backend only
  tag_regex: z.string().optional(),
});
export type MiseToolOptions = z.infer<typeof MiseToolOptions>;

const MiseTool = z.union([
  z.string(),
  MiseToolOptions.extend({
    version: z.string().optional(),
  }),
  z.array(z.string()),
]);
export type MiseTool = z.infer<typeof MiseTool>;

export const MiseFile = Toml.pipe(
  z.object({
    tools: z.record(MiseTool),
  }),
);
export type MiseFile = z.infer<typeof MiseFile>;
