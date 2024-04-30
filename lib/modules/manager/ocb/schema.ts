import { z } from 'zod';

const Entry = z.object({
  gomod: z.string(),
});

const ModuleSchema = z.array(Entry).optional();
export type Module = z.infer<typeof ModuleSchema>;

export const OCBConfigSchema = z.object({
  dist: z.object({
    otelcol_version: z.string().optional(),
    module: z.string().optional(),
    version: z.string().optional(),
  }),
  extensions: ModuleSchema,
  exporters: ModuleSchema,
  receivers: ModuleSchema,
  processors: ModuleSchema,
  connectors: ModuleSchema,
});
export type OCBConfig = z.infer<typeof OCBConfigSchema>;
