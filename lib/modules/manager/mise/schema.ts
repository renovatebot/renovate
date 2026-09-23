import { z } from 'zod/v4';
import { Toml } from '../../../util/schema-utils/index.ts';

export const MiseRegistryJson = z.object({
  meta: z.object({
    version: z.string(),
  }),
  tools: z.record(z.string(), z.record(z.string(), z.string())),
});

const MiseToolOptions = z.object({
  // ubi backend only
  tag_regex: z.string().optional(),
  // github and gitlab backends
  version_prefix: z.string().optional(),
});
export type MiseToolOptions = z.infer<typeof MiseToolOptions>;

const MiseToolObject = MiseToolOptions.extend({
  version: z.string().optional(),
});

/**
 * A single tool entry: either a plain version string or an inline table,
 * e.g. `"3.11.2"` or `{ version = "3.11.2", virtualenv = ".venv" }`.
 */
const MiseToolValue = z.union([z.string(), MiseToolObject]);
export type MiseToolValue = z.infer<typeof MiseToolValue>;

/**
 * A tool may also be declared as an array of entries, in which case only
 * the first (primary) one is managed. Array items may mix both forms.
 */
const MiseTool = z.union([MiseToolValue, z.array(MiseToolValue)]);
export type MiseTool = z.infer<typeof MiseTool>;

const MiseTask = z
  .object({
    tools: z.record(z.string(), MiseTool).optional(),
  })
  .passthrough()
  .catch({});

export const MiseFile = Toml.pipe(
  z.object({
    tools: z.record(z.string(), MiseTool).default({}),
    tasks: z.record(z.string(), MiseTask).default({}),
  }),
);
export type MiseFile = z.infer<typeof MiseFile>;

const MiseLockTool = z.object({
  version: z.string(),
  specifiers: z.array(z.string()).optional(),
  backend: z.string().optional(),
  options: z.record(z.string(), z.string()).optional(),
  platforms: z
    .record(
      z.string(),
      z.object({
        checksum: z.string().optional(),
        size: z.number().optional(),
        url: z.string().optional(),
      }),
    )
    .optional(),
});
export type MiseLockTool = z.infer<typeof MiseLockTool>;

export const MiseLockFile = Toml.pipe(
  z.object({
    tools: z.record(z.string(), z.array(MiseLockTool)),
  }),
);
export type MiseLockFile = z.infer<typeof MiseLockFile>;
