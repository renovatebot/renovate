import { z } from 'zod/v3';
import { Json, Yaml } from '../../../util/schema-utils/index.ts';

export const KasRepo = z.object({
  name: z.string().optional(),
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

const KasProjectBase = z
  .object({
    header: z.object({
      version: z.number(),
      includes: z.array(KasInclude).optional(),
    }),
    repos: z.record(z.string(), KasRepo.nullable().optional()).optional(),
  })
  .catchall(z.unknown());

export const KasProjectJson = Json.pipe(KasProjectBase);
export const KasProjectYaml = Yaml.pipe(KasProjectBase);

const KasLockFileBase = z.object({
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

export const KasLockFileJson = Json.pipe(KasLockFileBase);
export const KasLockFileYaml = Yaml.pipe(KasLockFileBase);

export const KasDump = Json.pipe(
  z.object(KasProjectBase.shape).merge(z.object(KasLockFileBase.shape)),
);

export type KasRepo = z.infer<typeof KasRepo>;
export type KasProject = z.infer<typeof KasProjectBase>;
export type KasLockFile = z.infer<typeof KasLockFileBase>;
export type KasDump = z.infer<typeof KasDump>;
