import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'dependencies',
    description: 'Listed under a `dependencies` section of a module file',
  },
  {
    depType: 'test-dependencies',
    description: 'Listed under a `test-dependencies` section of a module file',
  },
  {
    depType: 'settings',
    description:
      'A built-in technology version, annotation processor or compiler plugin taken from a `settings` section',
  },
  {
    depType: 'versionCatalog',
    description: 'A Maven library declared in `libs.versions.toml`',
  },
  {
    depType: 'mavenPlugins',
    description: 'A Maven plugin or one of its dependencies',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Dependency sections may be qualified with a platform, and the qualifier is kept in the `depType`, so `dependencies@jvm` produces the `depType` `dependencies@jvm`.';
