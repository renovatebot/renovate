import type { DepTypeMetadata } from '../types.ts';

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
