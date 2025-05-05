import { z } from 'zod';
import { LooseRecord, Toml, Yaml } from '../../../util/schema-utils';
import { CondaDatasource } from '../../datasource/conda/';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { PypiDatasource } from '../../datasource/pypi';
import * as condaVersion from '../../versioning/conda/';
import { id as gitRefVersionID } from '../../versioning/git';
import { id as pep440VersionID } from '../../versioning/pep440/';
import type { PackageDependency } from '../types';

export type Channels = z.infer<typeof Channel>[];

const Channel = z.union([
  z.string(),
  z.object({ channel: z.string(), priority: z.number() }),
]);

export interface PixiPackageDependency extends PackageDependency {
  channel?: string;
  channels?: Channels;
}

function collectNamedPackages(
  packages: Record<string, PackageDependency>,
): PackageDependency[] {
  return Object.entries(packages).map(([depName, config]) => {
    return {
      ...config,
      depName,
    };
  });
}

const PypiDependency = z
  .union([
    z.string().transform((version) => ({ version })),
    z.object({ version: z.string() }),
  ])
  .transform(({ version }) => {
    return {
      currentValue: version,
      versioning: pep440VersionID,
      datasource: PypiDatasource.id,
      depType: 'pypi-dependencies',
    } satisfies PixiPackageDependency;
  });

const PypiGitDependency = z
  .object({ git: z.string(), rev: z.optional(z.string()) })
  .transform(({ git, rev }) => {
    // empty ref default to HEAD, so do we not need to do anything
    if (!rev) {
      return {
        currentValue: rev,
        packageName: git,
        datasource: GitRefsDatasource.id,
        depType: 'pypi-dependencies',
        versioning: gitRefVersionID,
        skipStage: 'extract',
        skipReason: 'unspecified-version',
      } satisfies PixiPackageDependency;
    }

    return {
      currentValue: rev,
      packageName: git,
      datasource: GitRefsDatasource.id,
      depType: 'pypi-dependencies',
      versioning: gitRefVersionID,
    } satisfies PixiPackageDependency;
  });

const PypiDependencies = LooseRecord(
  z.string(),
  z.union([PypiDependency, PypiGitDependency]),
).transform(collectNamedPackages);

const CondaDependency = z
  .union([
    z.string().transform((version) => ({ version, channel: undefined })),
    z.object({ version: z.string(), channel: z.optional(z.string()) }),
  ])
  .transform(({ version, channel }) => {
    return {
      currentValue: version,
      versioning: condaVersion.id,
      datasource: CondaDatasource.id,
      depType: 'dependencies',
      channel,
    } satisfies PixiPackageDependency;
  });

const CondaDependencies = LooseRecord(z.string(), CondaDependency).transform(
  collectNamedPackages,
);

const Targets = LooseRecord(
  z.string(),
  z.object({
    dependencies: z.optional(CondaDependencies).default({}),
    'pypi-dependencies': z.optional(PypiDependencies).default({}),
  }),
).transform((val) => {
  const conda: PixiPackageDependency[] = [];
  const pypi: PixiPackageDependency[] = [];
  for (const value of Object.values(val)) {
    pypi.push(...value['pypi-dependencies']);

    conda.push(...value.dependencies);
  }

  return { pypi, conda };
});

const Project = z.object({
  channels: z.array(Channel).default([]),
  'requires-pixi': z.string().optional(),
  'channel-priority': z
    .union([z.literal('strict'), z.literal('disabled')])
    .default('strict'),
});

const DependenciesMixin = z
  .object({
    dependencies: z.optional(CondaDependencies).default({}),
    'pypi-dependencies': z.optional(PypiDependencies).default({}),
    target: z.optional(Targets).default({}),
  })
  .transform(
    (
      val,
    ): { pypi: PixiPackageDependency[]; conda: PixiPackageDependency[] } => {
      return {
        conda: [...val.dependencies, ...val.target.conda],
        pypi: [...val['pypi-dependencies'], ...val.target.pypi],
      };
    },
  );

const Features = LooseRecord(
  z.string(),
  z
    .object({
      channels: z.array(Channel).optional(),
    })
    .and(DependenciesMixin),
).transform(
  (
    features,
  ): {
    conda: PixiPackageDependency[];
    pypi: PixiPackageDependency[];
  } => {
    const pypi: PixiPackageDependency[] = [];
    const conda: PixiPackageDependency[] = [];

    for (const feature of Object.values(features)) {
      conda.push(
        ...feature.conda.map((item) => {
          return {
            ...item,
            channels: feature.channels,
          };
        }),
      );

      pypi.push(...feature.pypi);
    }

    return { pypi, conda };
  },
);

const PixiWorkspace = z
  .object({
    workspace: Project,
  })
  .transform((val) => {
    return { project: val.workspace };
  });

const PixiProject = z.object({
  project: Project,
});

/**
 * `$` of `pixi.toml` or `$.tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z
  .union([PixiWorkspace, PixiProject])
  .and(z.object({ feature: Features.default({}) }))
  .and(DependenciesMixin);

export type PixiConfig = z.infer<typeof PixiConfigSchema>;

export const PixiToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
