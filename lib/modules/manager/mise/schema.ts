import { z } from 'zod/v3';
import { Toml } from '../../../util/schema-utils/index.ts';

function createRecord(input: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const registry of input) {
    const [type, url] = registry.split(':');
    result[type] = url;
  }
  return result;
}

export const MiseRegistryJson = z
  .record(z.string(), z.array(z.string()))
  .transform((input) => {
    const result: Record<string, Record<string, string>> = {};

    for (const [key, val] of Object.entries(input)) {
      result[key] = createRecord(val);
    }
    return result;
  });

const MiseToolOptions = z.object({
  // ubi backend only
  tag_regex: z.string().optional(),
  // github backend only
  version_prefix: z.string().optional(),
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
