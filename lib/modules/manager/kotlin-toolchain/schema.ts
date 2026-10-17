import { z } from 'zod/v4';
import { coerceArray } from '../../../util/array.ts';
import {
  LooseArray,
  LooseRecord,
  Yaml,
} from '../../../util/schema-utils/index.ts';

const BomDependency = z.object({ bom: z.string() }).transform(({ bom }) => bom);

const MappedDependency = z
  .record(z.string(), z.unknown())
  .transform((entry, ctx) => {
    const keys = Object.keys(entry);
    if (keys.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Dependency mapping must have a single coordinate key',
      });
      return z.NEVER;
    }
    return keys[0];
  });

export const KotlinToolchainDependencies = LooseArray(
  z.union([z.string(), BomDependency, MappedDependency]),
);

export const KotlinToolchainCompilerPlugins = LooseArray(
  z
    .object({ dependency: z.string() })
    .transform(({ dependency }) => dependency),
);

const MavenPluginGoal = z.object({
  dependencies: KotlinToolchainDependencies.optional(),
});

export const KotlinToolchainMavenPlugins = z.union([
  KotlinToolchainDependencies,
  LooseRecord(MavenPluginGoal).transform((goals) =>
    Object.values(goals).flatMap((goal) => coerceArray(goal.dependencies)),
  ),
]);

const Repository = z
  .object({ url: z.string(), resolve: z.boolean().optional() })
  .transform(({ url, resolve }) => (resolve === false ? null : url));

export const KotlinToolchainRepositories = LooseArray(
  z.union([z.string(), Repository]),
);

export const KotlinToolchainFile = Yaml.pipe(z.record(z.string(), z.unknown()));

export type KotlinToolchainFile = z.infer<typeof KotlinToolchainFile>;
