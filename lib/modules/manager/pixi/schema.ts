import is from '@sindresorhus/is';
import { z } from 'zod';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseRecord, Toml, Yaml } from '../../../util/schema-utils';
import { CondaDatasource } from '../../datasource/conda/';
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
  channels?: (string | { channel: string; priority: number })[];
}

function collectNamedPackages(
  packages: Record<string, PackageDependency | null>,
): PackageDependency[] {
  return Object.entries(packages)
    .map(([depName, config]) => {
      if (is.nullOrUndefined(config)) {
        return;
      }

      return {
        ...config,
        depName,
      };
    })
    .filter((dep) => isNotNullOrUndefined(dep));
}

const PypiDepdency = z.union([
  z.string().transform((version) => {
    return {
      currentValue: version,
      versioning: pep440VersionID,
      datasource: PypiDatasource.id,
      depType: 'pypi-dependencies',
    } satisfies PixiPackageDependency;
  }),
  z.object({ version: z.string() }).transform(({ version }) => {
    return {
      currentValue: version,
      versioning: pep440VersionID,
      datasource: PypiDatasource.id,
      depType: 'pypi-dependencies',
    } satisfies PixiPackageDependency;
  }),
]);

const PypiGitDepdency = z
  .object({ git: z.string(), rev: z.optional(z.string()) })
  .transform(({ git, rev }) => {
    // empty ref default to HEAD, so do we not need to do anything
    if (!rev) {
      return null;
    }

    return {
      currentValue: rev,
      sourceUrl: git,
      depType: 'pypi-dependencies',
      gitRef: true,
      versioning: gitRefVersionID,
    } satisfies PixiPackageDependency;
  });

const PypiDependencies = LooseRecord(
  z.string(),
  z.union([PypiDepdency, PypiGitDepdency]),
)
  .catch({})
  .transform(collectNamedPackages);

const CondaDependency = z.union([
  z.string().transform((version) => {
    return {
      currentValue: version,
      versioning: condaVersion.id,
      datasource: CondaDatasource.id,
      depType: 'dependencies',
    } satisfies PixiPackageDependency;
  }),
  z
    .object({ version: z.string(), channel: z.optional(z.string()) })
    .transform(({ version, channel }) => {
      return {
        currentValue: version,
        versioning: condaVersion.id,
        datasource: CondaDatasource.id,
        depType: 'dependencies',
        channel,
      } satisfies PixiPackageDependency;
    }),
]);

const CondaDependencies = LooseRecord(z.string(), CondaDependency)
  .catch({})
  .transform(collectNamedPackages);

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
  channels: z.array(z.string()).default([]),
});

const DependencieSchemaMixin = z
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
    .and(DependencieSchemaMixin),
)
  .default({})
  .transform(
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

/**
 * `$` of `pixi.toml` or `$.tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z
  .object({ feature: Features })
  .and(DependencieSchemaMixin)
  .and(
    z.union([
      z
        .object({
          workspace: Project,
        })
        .transform((val) => {
          return { project: val.workspace };
        }),
      z.object({
        project: Project,
      }),
    ]),
  );

export type PixiConfig = z.infer<typeof PixiConfigSchema>;

export const PixiToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
