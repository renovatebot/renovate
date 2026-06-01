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

const MiseSettingScalar = z.union([z.string(), z.number(), z.boolean()]);
export type MiseSettingScalar = z.infer<typeof MiseSettingScalar>;

export type MiseSettingValue =
  | MiseSettingScalar
  | MiseSettingValue[]
  | { [key: string]: MiseSettingValue };

const MiseSettingValue: z.ZodType<MiseSettingValue> = z.lazy(() =>
  z.union([
    MiseSettingScalar,
    z.array(MiseSettingValue),
    z.record(MiseSettingValue),
  ]),
);

export const MiseFile = Toml.pipe(
  z.object({
    tools: z.record(z.string(), MiseTool).default({}),
    settings: z.record(z.string(), MiseSettingValue).default({}),
  }),
);
export type MiseFile = z.infer<typeof MiseFile>;

const MiseLockTool = z.object({
  version: z.string(),
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

export const MiseLockFile = Toml.pipe(
  z.object({
    tools: z.record(z.string(), z.array(MiseLockTool)),
  }),
);
export type MiseLockFile = z.infer<typeof MiseLockFile>;
