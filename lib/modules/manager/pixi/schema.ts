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

const pypiDependencies = z
  .record(
    z.string(),
    z.union([
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
      z
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
        }),
      z.any().transform(() => null),
    ]),
  )
  .transform(collectNamedPackages);

const condaDependencies = z
  .record(
    z.string(),
    z.union([
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
      z.any().transform(() => null),
    ]),
  )
  .transform(collectNamedPackages);

const Targets = LooseRecord(
  z.string(),
  z.object({
    dependencies: z.optional(condaDependencies).default({}),
    'pypi-dependencies': z.optional(pypiDependencies).default({}),
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

const projectSchema = z.object({
  channels: z.array(z.string()).default([]),
});

const DependencieSchemaMixin = z
  .object({
    dependencies: z.optional(condaDependencies).default({}),
    'pypi-dependencies': z.optional(pypiDependencies).default({}),
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

/**
 * `$` of `pixi.toml` or `$.tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z
  .object({
    feature: LooseRecord(
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
      ),
  })
  .and(DependencieSchemaMixin)
  .and(
    z.union([
      z
        .object({
          workspace: projectSchema,
        })
        .transform((val) => {
          return { project: val.workspace };
        }),
      z.object({
        project: projectSchema,
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
