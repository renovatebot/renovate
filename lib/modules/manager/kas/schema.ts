import { z } from 'zod/v4';
import { Json, Yaml } from '../../../util/schema-utils/index.ts';

export const KasRepo = z.object({
  url: z.string().optional(),
  commit: z.string().optional(),
  branch: z.string().nullable().optional(),
  tag: z.string().nullable().optional(),
  type: z.enum(['git', 'hg']).default('git').optional(),
});

export const KasInclude = z.union([
  z.string(),
  z.object({
    repo: z.string(),
    file: z.string(),
  }),
]);

const KasProject = z
  .object({
    header: z.object({
      version: z.number(),
      includes: z.array(KasInclude).optional(),
    }),
    repos: z.record(z.string(), KasRepo.nullable().optional()).optional(),
  })
  .catchall(z.unknown());

export const KasProjectJson = Json.pipe(KasProject);
export const KasProjectYaml = Yaml.pipe(KasProject);

const KasLockFile = z.object({
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
});

export const KasLockFileJson = Json.pipe(KasLockFile);
export const KasLockFileYaml = Yaml.pipe(KasLockFile);

export const KasDump = Json.pipe(z.intersection(KasProject, KasLockFile));

export type KasRepo = z.infer<typeof KasRepo>;
export type KasProject = z.infer<typeof KasProject>;
export type KasLockFile = z.infer<typeof KasLockFile>;
export type KasDump = z.infer<typeof KasDump>;
