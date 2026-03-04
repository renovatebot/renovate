import { z } from 'zod/v3';
import {
  LooseArray,
  LooseRecord,
  Yaml,
} from '../../../util/schema-utils/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { id as semverVersioning } from '../../versioning/semver/index.ts';
import { getDep } from '../dockerfile/extract.ts';
import type { PackageDependency } from '../types.ts';

export const BatectConfig = Yaml.pipe(
  z.object({
    containers: LooseRecord(
      z.string(),
      z.object({ image: z.string() }).transform(({ image }) => image),
    )
      .transform((x) => Object.values(x))
      .catch([]),
    include: LooseArray(
      z.union([
        z.object({
          type: z.literal('git'),
          repo: z.string(),
          ref: z.string(),
        }),
        z.object({
          type: z.literal('file'),
          path: z.string(),
        }),
        z.string().transform((path) => ({ type: 'file' as const, path })),
      ]),
    ).catch([]),
  }),
).transform(({ containers, include }) => {
  // TODO: @zharinov How to pass `registryAliases` to `getDep`?
  const imageDependencies = containers.map((image) => getDep(image));

  const bundleDependencies: PackageDependency[] = [];
  const fileIncludes: string[] = [];

  for (const item of include) {
    if (item.type === 'git') {
      bundleDependencies.push({
        depName: item.repo,
        currentValue: item.ref,
        versioning: semverVersioning,
        datasource: GitTagsDatasource.id,
        commitMessageTopic: 'bundle {{depName}}',
      });
    } else {
      fileIncludes.push(item.path);
    }
  }

  return {
    imageDependencies,
    bundleDependencies,
    fileIncludes,
  };
});

export type BatectConfig = z.infer<typeof BatectConfig>;
