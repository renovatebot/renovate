import { z } from 'zod/v4';
import { Json, Nullish, Yaml } from '../../../util/schema-utils/index.ts';

export const KasRepo = z.object({
  url: z.string().optional(),
  commit: z.string().optional(),
  branch: Nullish(z.string()),
  tag: Nullish(z.string()),
  type: z.enum(['git', 'hg']).default('git').optional(),
});

export const KasInclude = z.union([
  z.string(),
  z.object({
    repo: z.string(),
    file: z.string(),
  }),
]);

// one schema for project files, include files and lock files
export const KasConfig = z
  .object({
    header: z.object({
      version: z.number(),
      includes: z.array(KasInclude).optional(),
    }),
    repos: z.record(z.string(), Nullish(KasRepo)).optional(),
    defaults: z
      .object({
        repos: z
          .object({
            branch: Nullish(z.string()),
            tag: Nullish(z.string()),
          })
          .catchall(z.unknown())
          .optional(),
      })
      .catchall(z.unknown())
      .optional(),
    overrides: z
      .object({
        repos: z
          .record(
            z.string(),
            z.object({
              commit: z.string().optional(),
            }),
          )
          .optional(),
      })
      .optional(),
  })
  .catchall(z.unknown());

export const KasConfigJson = Json.pipe(KasConfig);
export const KasConfigYaml = Yaml.pipe(KasConfig);

export type KasRepo = z.infer<typeof KasRepo>;
export type KasConfig = z.infer<typeof KasConfig>;
