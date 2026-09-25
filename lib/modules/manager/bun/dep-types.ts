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
    description: 'Listed under `resolutions`',
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
  'Catalog dependencies produce dynamic `depType` values: `bun.catalog.default` for the default catalog, and `bun.catalog.<name>` for named catalogs (see [Bun catalogs](https://bun.sh/docs/install/catalogs)).';
