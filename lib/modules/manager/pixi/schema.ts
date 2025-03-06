import is from '@sindresorhus/is';
import { z } from 'zod';
import { isNotNullOrUndefined } from '../../../util/array';
import { LooseRecord, Toml, Yaml } from '../../../util/schema-utils';
import { ensureTrailingSlash } from '../../../util/url';
import { CondaDatasource } from '../../datasource/conda/';
import { defaultRegistryUrl as defaultCondaRegistryAPi } from '../../datasource/conda/common';
import { PypiDatasource } from '../../datasource/pypi';
import * as condaVersion from '../../versioning/conda/';
import { id as gitRefVersionID } from '../../versioning/git';
import { id as pep440VersionID } from '../../versioning/pep440/';
import type { PackageDependency } from '../types';

type Channel = string | { channel: string; priority: number };
type Channels = Channel[];

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
 * config of `pixi.toml` of `tool.pixi` of `pyproject.toml`
 */
export const PixiConfigSchema = z
  .object({
    feature: LooseRecord(
      z.string(),
      z
        .object({
          channels: z
            .array(
              z.union([
                z.string(),
                z.object({ channel: z.string(), priority: z.number() }),
              ]),
            )
            .optional(),
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
  )
  .transform(
    (
      val,
    ): {
      conda: PixiPackageDependency[];
      pypi: PixiPackageDependency[];
    } => {
      const project = val.project;
      const channels: Channels = structuredClone(project.channels);

      // resolve channels and build registry urls for each channel with order
      const conda: PixiPackageDependency[] = val.conda
        .map((item) => {
          return { ...item, channels } as PixiPackageDependency;
        })
        .concat(
          val.feature.conda.map(
            (item: PixiPackageDependency): PixiPackageDependency => {
              return {
                ...item,
                channels: [...(item.channels ?? []), ...project.channels],
              };
            },
          ),
        )
        .map((item) => {
          const channels = orderChannels(item.channels);
          if (item.channel) {
            return {
              ...item,
              channels,
              registryUrls: [channelToRegistryUrl(item.channel)],
            };
          }

          if (channels.length === 0) {
            return {
              ...item,
              channels,
              skipStage: 'extract',
              skipReason: 'unknown-registry',
            };
          }

          return {
            ...item,
            channels,
            registryUrls: channels.map(channelToRegistryUrl),
          } satisfies PixiPackageDependency;
        });

      return {
        conda,
        pypi: val.pypi.concat(val.feature.pypi),
      };
    },
  );

function channelToRegistryUrl(channel: string): string {
  if (looksLikeUrl(channel)) {
    return ensureTrailingSlash(channel);
  }

  return defaultCondaRegistryAPi + channel + '/';
}

function orderChannels(channels: Channels = []): string[] {
  return channels
    .map((channel, index) => {
      if (is.string(channel)) {
        return { channel, priority: 0, index };
      }

      return { ...channel, index: 0 };
    })
    .toSorted((a, b) => {
      // frist based on priority then based on index
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      return a.index - b.index;
    })
    .map((c) => c.channel);
}

function looksLikeUrl(s: string): boolean {
  return s.startsWith('https://') || s.startsWith('http://');
}

export type PixiConfig = z.infer<typeof PixiConfigSchema>;

export const PixiToml = Toml.pipe(PixiConfigSchema);

export const LockfileYaml = Yaml.pipe(
  z.object({
    version: z.number(),
  }),
);
