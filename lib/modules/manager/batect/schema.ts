import { z } from 'zod';
import { LooseArray, LooseRecord, Yaml } from '../../../util/schema-utils';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { id as dockerVersioning } from '../../versioning/docker';
import { id as semverVersioning } from '../../versioning/semver';
import { getDep } from '../dockerfile/extract';

export const BatectConfigSchema = Yaml.pipe(
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
  const imageDependencies = containers.map((image) => ({
    ...getDep(image),
    versioning: dockerVersioning,
  }));

  const gitIncludes = [];
  const fileIncludes = [];

  for (const item of include) {
    if (item.type === 'git') {
      gitIncludes.push(item);
    } else {
      fileIncludes.push(item.path);
    }
  }

  const bundleDependencies = gitIncludes.map((bundle) => ({
    depName: bundle.repo,
    currentValue: bundle.ref,
    versioning: semverVersioning,
    datasource: GitTagsDatasource.id,
    commitMessageTopic: 'bundle {{depName}}',
  }));

  return {
    imageDependencies,
    bundleDependencies,
    fileIncludes,
  };
});

export type BatectConfig = z.infer<typeof BatectConfigSchema>;
