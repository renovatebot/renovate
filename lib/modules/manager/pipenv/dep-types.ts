import type { DepTypeMetadata } from '../types.ts';

/**
 * pipenv depTypes are dynamic: they come from the TOML section names
 * in the Pipfile. Any section that is not `source` or `requires` is
 * treated as a dependency section. The values below cover the standard
 * section names.
 */
export const knownDepTypes = [
  {
    depType: 'packages',
    description: 'Listed under `[packages]`',
  },
  {
    depType: 'dev-packages',
    description: 'Listed under `[dev-packages]`',
  },
] as const satisfies readonly DepTypeMetadata[];

export const supportsDynamicDepTypesNote =
  'Dependencies from other package category groups in the Pipfile use the group name as the `depType`.';
