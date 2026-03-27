import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    prettyDepType: 'dependency',
    description: 'Listed under `dependencies`',
  },
  {
    depType: 'devDependencies',
    prettyDepType: 'devDependency',
    description: 'Listed under `devDependencies`',
  },
  {
    depType: 'optionalDependencies',
    prettyDepType: 'optionalDependency',
    description: 'Listed under `optionalDependencies`',
  },
  {
    depType: 'peerDependencies',
    prettyDepType: 'peerDependency',
    description: 'Listed under `peerDependencies`',
  },
  {
    depType: 'engines',
    prettyDepType: 'engine',
    description: 'Listed under `engines`',
  },
  {
    depType: 'volta',
    prettyDepType: 'volta',
    description: 'Listed under `volta`',
  },
  {
    depType: 'resolutions',
    prettyDepType: 'resolutions',
    description: 'Listed under `resolutions` (Yarn)',
  },
  {
    depType: 'packageManager',
    prettyDepType: 'packageManager',
    description: 'Listed under `packageManager`',
  },
  {
    depType: 'overrides',
    prettyDepType: 'overrides',
    description: 'Listed under `overrides`',
  },
  {
    depType: 'pnpm',
    prettyDepType: 'pnpm',
    description: 'Listed under the top-level `pnpm` field',
  },
  {
    depType: 'pnpm.overrides',
    prettyDepType: 'overrides',
    description: 'Listed under `pnpm.overrides`',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Additionally, catalog dependencies produce dynamic `depType` values: `pnpm.catalog.<name>` for [pnpm catalogs](https://pnpm.io/catalogs#defining-catalogs) and `yarn.catalog.<name>` for [yarn catalogs](https://yarnpkg.com/features/catalogs).';

export type NpmDepType = (typeof knownDepTypes)[number]['depType'] | (string & {});
