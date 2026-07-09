import { z } from 'zod/v4';
import {
  LooseArray,
  LooseRecord,
  Nullish,
  Toml,
} from '../../../util/schema-utils/index.ts';
import { pep508ToPackageDependency } from '../pep621/utils.ts';
import type { PackageDependency } from '../types.ts';

function parsePep508Dep(
  depType: string,
  depStr: string,
): PackageDependency | null {
  if (depStr.trimStart().startsWith('-')) {
    return null;
  }
  return pep508ToPackageDependency(depType, depStr);
}

type ToxPackageDependency = z.ZodType<PackageDependency>;

function Pep508Dep(depType: string): ToxPackageDependency {
  return z.string().transform((x, ctx) => {
    const res = parsePep508Dep(depType, x);
    if (!res) {
      ctx.addIssue({
        code: 'custom',
        message: 'not a valid PEP 508 dep',
        fatal: true,
      });
      return z.NEVER;
    }
    return res;
  });
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
      const dep = parsePep508Dep(depType, depStr);
      if (dep) {
        deps.push(dep);
      }
    }
  }
  return deps;
});

export const ToxConfig = z.object({
  requires: LooseArray(Pep508Dep('requires')).catch([]),
  env_run_base: Nullish(ToxEnvConfig),
  env: Nullish(ToxEnvRecord),
});
export type ToxConfig = z.infer<typeof ToxConfig>;

export const ToxFile = Toml.pipe(ToxConfig);

export const ToxPyProject = Toml.pipe(
  z.object({
    tool: z.object({
      tox: ToxConfig,
    }),
  }),
);
