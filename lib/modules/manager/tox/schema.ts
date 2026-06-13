import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
  Toml,
} from '../../../util/schema-utils/index.ts';
import { pep508ToPackageDependency } from '../pep621/utils.ts';
import type { PackageDependency } from '../types.ts';

type ToxPackageDependency = z.ZodType<PackageDependency<Record<string, any>>>;

function Pep508Dep(depType: string): ToxPackageDependency {
  return z.string().transform((x, ctx) => {
    if (x.trimStart().startsWith('-')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `skipping tox flag entry: ${x}`,
        fatal: true,
      });
      return z.NEVER;
    }

    const res = pep508ToPackageDependency(depType, x);
    if (!res) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'should be a valid PEP508 dependency',
        fatal: true,
      });
      return z.NEVER;
    }

    return res;
  }) as ToxPackageDependency;
}

const ToxEnvConfig = z.object({
  deps: LooseArray(Pep508Dep('env_run_base')).catch([]),
});

const ToxEnvRecord = LooseRecord(
  z.string(),
  z.object({
    deps: LooseArray(z.string()).catch([]),
  }),
).transform((envs) => {
  const deps: PackageDependency[] = [];
  for (const [envName, envConfig] of Object.entries(envs)) {
    const depType = `env.${envName}`;
    for (const depStr of envConfig.deps) {
      if (depStr.trimStart().startsWith('-')) {
        continue;
      }
      const dep = pep508ToPackageDependency(depType, depStr);
      if (dep) {
        deps.push(dep);
      }
    }
  }
  return deps;
});

export const ToxConfig = z.object({
  requires: LooseArray(Pep508Dep('requires')).catch([]),
  env_run_base: ToxEnvConfig.optional().catch(undefined),
  env: ToxEnvRecord.optional().catch(undefined),
});
export type ToxConfig = z.infer<typeof ToxConfig>;

export const ToxFile = Toml.pipe(ToxConfig);

export const ToxPyProject = Toml.pipe(
  z.object({
    tool: z
      .object({
        tox: ToxConfig.optional().catch(undefined),
      })
      .optional()
      .catch(undefined),
  }),
);
