import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'plugin',
    description: 'A Gradle plugin dependency',
  },
  {
    depType: 'dependencies',
    description: 'A standard Gradle dependency',
  },
  {
    depType: 'devDependencies',
    description: 'A dependency from a `buildSrc` project',
  },
  {
    depType: 'test',
    description:
      'A test dependency from the `gradle-consistent-versions` plugin lock file',
  },
] as const satisfies readonly DepTypeMetadata[];
