import { z } from 'zod/v4';

export const BunCatalogs = z
  .object({
    catalog: z.record(z.string(), z.string()).optional(),
    catalogs: z.record(z.string(), z.record(z.string(), z.string())).optional(),
    workspaces: z
      .object({
        catalog: z.record(z.string(), z.string()).optional(),
        catalogs: z
          .record(z.string(), z.record(z.string(), z.string()))
          .optional(),
      })
      .optional()
      .catch(undefined),
  })
  .transform((val) => ({
    catalog: val.catalog ?? val.workspaces?.catalog,
    catalogs: val.catalogs ?? val.workspaces?.catalogs,
  }));
export type BunCatalogs = z.infer<typeof BunCatalogs>;
