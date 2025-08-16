import { z } from 'zod';

const Entry = z.object({
  gomod: z.string(),
});

const Module = z.array(Entry).optional();
export type Module = z.infer<typeof Module>;

export const OCBConfig = z.object({
  dist: z.object({
    otelcol_version: z.string().optional(),
    module: z.string().optional(),
    version: z.string().optional(),
  }),
  extensions: Module,
  exporters: Module,
  receivers: Module,
  processors: Module,
  providers: Module,
  connectors: Module,
});
export type OCBConfig = z.infer<typeof OCBConfig>;
